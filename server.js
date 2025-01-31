require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const ExaminationDetails = require('./models/ExaminationDetails');
const BankDetails = require('./models/BankDetails');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration based on deployment mode
const corsOptions = {
    origin: process.env.DEPLOYMENT_MODE === 'local' 
        ? ['http://localhost:3000', 'http://127.0.0.1:3000']
        : process.env.RENDER_EXTERNAL_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB Connection with retry logic
async function connectToMongoDB() {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
        console.error('MONGODB_URI environment variable is not set!');
        process.exit(1); // Exit the process if MongoDB URI is not set
    }

    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true
        });
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        // Retry connection after 5 seconds
        setTimeout(connectToMongoDB, 5000);
    }
}

connectToMongoDB();

// Handle MongoDB connection errors
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    connectToMongoDB();
});

const EXAM_NAME_FILE = path.join(__dirname, 'local_data.txt');

// Initialize exam name file if it doesn't exist
async function initExamNameFile() {
    try {
        await fs.access(EXAM_NAME_FILE);
    } catch (error) {
        // File doesn't exist, create it with default value
        await fs.writeFile(EXAM_NAME_FILE, 'Winter - 2024');
    }
}

initExamNameFile();

// API Routes
app.post('/api/examination-details', async (req, res) => {
    try {
        const examinationData = req.body;
        
        // Create a new examination details document
        const newExamination = new ExaminationDetails({
            ...examinationData,
            examDate: new Date(examinationData.examDate)
        });

        // Save the new examination details
        const savedExamination = await newExamination.save();
        
        res.status(201).json({
            success: true,
            message: 'Examination details saved successfully',
            data: savedExamination
        });
    } catch (error) {
        console.error('Error saving examination details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error saving examination details'
        });
    }
});

app.put('/api/examination-details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Find the existing record
        const existingRecord = await ExaminationDetails.findById(id);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Examination details not found'
            });
        }

        // Keep the original examName
        updateData.examName = existingRecord.examName;

        // Update the record
        const updatedExamination = await ExaminationDetails.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Examination details updated successfully',
            data: updatedExamination
        });
    } catch (error) {
        console.error('Error updating examination details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating examination details'
        });
    }
});

app.post('/api/submit-details', async (req, res) => {
    try {
        console.log('Received form data:', req.body);

        if (!req.body.examinerName) {
            throw new Error('Examiner name is required');
        }

        let bankDetailId = req.body.bankDetailId;

        // If no bankDetailId is provided, create new bank details
        if (!bankDetailId) {
            const bankDetails = new BankDetails({
                examinerName: req.body.examinerName,
                bankName: req.body.bankName,
                branchName: req.body.bankBranch,
                branchCode: req.body.bankBranchCode,
                accountNo: req.body.accountNo,
                ifscCode: req.body.ifscCode
            });

            try {
                const savedBankDetails = await bankDetails.save();
                bankDetailId = savedBankDetails._id;
                console.log('Saved new bank details:', savedBankDetails);
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key error - find existing bank details
                    const existingBankDetails = await BankDetails.findOne({
                        examinerName: req.body.examinerName,
                        accountNo: req.body.accountNo
                    });
                    
                    if (!existingBankDetails) {
                        throw new Error('Could not find or create bank details');
                    }
                    
                    bankDetailId = existingBankDetails._id;
                    console.log('Using existing bank details:', existingBankDetails);
                } else {
                    throw error;
                }
            }
        }

        // Validate bankDetailId exists
        const bankDetailExists = await BankDetails.findById(bankDetailId);
        if (!bankDetailExists) {
            throw new Error('Invalid bank detail ID');
        }

        // Create examination details with bank detail reference
        const examinationDetails = new ExaminationDetails({
            examName: req.body.examName,
            branch: req.body.branch,
            branchCode: req.body.branchCode,
            semester: req.body.semester,
            subjectCode: req.body.subjectCode,
            examDate: req.body.examDate,
            examinerType: req.body.examinerType,
            examinerName: req.body.examinerName,
            numberOfStudents: req.body.numberOfStudents,
            taAmount: req.body.taAmount,
            daAmount: req.body.daAmount,
            honorarium: req.body.honorarium,
            billAmount: req.body.taAmount + req.body.daAmount + req.body.honorarium,
            mobileNo: req.body.mobileNo,
            bankDetailId: bankDetailId
        });

        const savedExamDetails = await examinationDetails.save();
        console.log('Saved examination details:', savedExamDetails);

        res.status(201).json({
            success: true,
            message: 'Details saved successfully',
            data: {
                examinationId: savedExamDetails._id,
                bankDetailId: bankDetailId
            }
        });
    } catch (error) {
        console.error('Error saving details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error saving details',
            error: error.message
        });
    }
});

app.post('/api/bank-details', async (req, res) => {
    try {
        const { examinerName, bankName, branchName, branchCode, accountNo, ifscCode } = req.body;

        // Validate required fields
        if (!examinerName || !bankName || !branchName || !branchCode || !accountNo || !ifscCode) {
            return res.status(400).json({
                success: false,
                message: 'All bank details fields are required'
            });
        }

        // Create new bank details
        const bankDetails = new BankDetails({
            examinerName,
            bankName,
            branchName,
            branchCode,
            accountNo,
            ifscCode
        });

        try {
            const savedBankDetails = await bankDetails.save();
            res.status(201).json({
                success: true,
                message: 'Bank details saved successfully',
                data: savedBankDetails
            });
        } catch (error) {
            if (error.code === 11000) {
                // Duplicate key error - find and return existing bank details
                const existingBankDetails = await BankDetails.findOne({
                    examinerName,
                    accountNo
                });

                if (existingBankDetails) {
                    return res.status(200).json({
                        success: true,
                        message: 'Using existing bank details',
                        data: existingBankDetails
                    });
                }
            }
            throw error;
        }
    } catch (error) {
        console.error('Error saving bank details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to save bank details'
        });
    }
});

// Get all bank details for dropdown
app.get('/api/bank-details', async (req, res) => {
    try {
        const details = await BankDetails.find()
            .sort({ examinerName: 1 })
            .select('examinerName bankName accountNo _id');
        
        const formattedDetails = details.map(detail => ({
            id: detail._id,
            displayName: `${detail.examinerName} - ${detail.bankName} - ${detail.accountNo}`
        }));

        res.json({
            success: true,
            data: formattedDetails
        });
    } catch (error) {
        console.error('Error fetching bank details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get bank details by ID
app.get('/api/bank-details/:id', async (req, res) => {
    try {
        const details = await BankDetails.findById(req.params.id);
        if (!details) {
            return res.status(404).json({
                success: false,
                message: 'Bank details not found'
            });
        }
        res.json({
            success: true,
            data: details
        });
    } catch (error) {
        console.error('Error fetching bank detail:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all examination details
app.get('/api/examination-details', async (req, res) => {
    try {
        const details = await ExaminationDetails.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: details
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get bank details by examination ID
app.get('/api/bank-details/:examinationId', async (req, res) => {
    try {
        const details = await BankDetails.findOne({ examinationId: req.params.examinationId });
        if (!details) {
            return res.status(404).json({
                success: false,
                message: 'Bank details not found'
            });
        }
        res.json({
            success: true,
            data: details
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get filter options
app.get('/api/filter-options', async (req, res) => {
    try {
        const examNames = await ExaminationDetails.distinct('examName');
        const dates = await ExaminationDetails.distinct('examDate');
        
        res.json({
            examNames,
            dates
        });
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get exam names
app.get('/api/exam-names', async (req, res) => {
    try {
        // Get unique exam names using distinct
        const examNames = await ExaminationDetails.distinct('examName');
        
        // Sort exam names in descending order (most recent first)
        const sortedExamNames = examNames.sort().reverse();

        res.json(sortedExamNames);
    } catch (error) {
        console.error('Error fetching exam names:', error);
        res.status(500).json({ error: 'Failed to fetch exam names' });
    }
});

// Get branches by exam name
app.get('/api/branches/:examName', async (req, res) => {
    try {
        const { examName } = req.params;
        const branches = await ExaminationDetails.distinct('branch', { examName: examName });
        res.json(branches.sort());
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// Get dates by exam name and branch
app.get('/api/dates/:examName/:branch', async (req, res) => {
    try {
        const { examName, branch } = req.params;
        const dates = await ExaminationDetails.distinct('examDate', { examName, branch });
        res.json(dates.sort());
    } catch (error) {
        console.error('Error fetching dates:', error);
        res.status(500).json({ error: 'Failed to fetch dates' });
    }
});

// Get examiner types by exam name, branch, and date
app.get('/api/examiner-types/:examName/:branch/:date', async (req, res) => {
    try {
        const { examName, branch, date } = req.params;
        const query = { examName };
        
        if (branch !== 'ALL') {
            query.branch = branch;
        }
        
        if (date !== 'ALL') {
            query.examDate = new Date(date);
        }

        const examinerTypes = await ExaminationDetails.distinct('examinerType', query);
        res.json(examinerTypes.sort());
    } catch (error) {
        console.error('Error fetching examiner types:', error);
        res.status(500).json({ error: 'Failed to fetch examiner types' });
    }
});

// Get filtered daily sheet data with sorting
app.get('/api/daily-sheet', async (req, res) => {
    try {
        const { examName, branch, examDate, examinerType } = req.query;
        const query = {};

        if (examName) query.examName = examName;
        if (branch && branch !== 'ALL') query.branch = branch;
        if (examDate && examDate !== 'ALL') query.examDate = new Date(examDate);
        if (examinerType && examinerType !== 'ALL') query.examinerType = examinerType;

        const examinerTypeOrder = {
            'External': 1,
            'Internal': 2,
            'Lab Assistant': 3,
            'Peon': 4
        };

        const data = await ExaminationDetails.find(query)
            .sort({ 
                examDate: 1,
                branch: 1,
                examinerType: 1
            })
            .select('-__v')
            .lean();

        // Sort by examiner type order
        data.sort((a, b) => {
            if (a.examDate.getTime() !== b.examDate.getTime()) {
                return a.examDate - b.examDate;
            }
            return examinerTypeOrder[a.examinerType] - examinerTypeOrder[b.examinerType];
        });

        if (data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No records found for the selected criteria'
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching daily sheet data:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get examiner details based on branch and type
app.get('/api/examiner-details', async (req, res) => {
    try {
        const { branch, examinerType } = req.query;
        console.log('Received query:', { branch, examinerType });

        // Find examiner details
        const examiners = await ExaminationDetails.find({
            branch,
            examinerType
        })
        .populate('bankDetailId')
        .select('examinerName panCard mobileNo bankDetailId')
        .distinct('examinerName');

        // Get unique examiner details
        const uniqueExaminers = [];
        const seenExaminers = new Set();

        for (const examinerName of examiners) {
            if (!seenExaminers.has(examinerName)) {
                seenExaminers.add(examinerName);
                const examiner = await ExaminationDetails.findOne({
                    examinerName,
                    branch,
                    examinerType
                }).populate('bankDetailId');
                
                if (examiner) {
                    uniqueExaminers.push({
                        examinerName: examiner.examinerName,
                        examinerType: examiner.examinerType,
                        panCard: examiner.panCard,
                        mobileNo: examiner.mobileNo,
                        bankDetailId: examiner.bankDetailId?._id,
                        bankName: examiner.bankDetailId?.bankName,
                        branchName: examiner.bankDetailId?.branchName,
                        branchCode: examiner.bankDetailId?.branchCode,
                        accountNo: examiner.bankDetailId?.accountNo,
                        ifscCode: examiner.bankDetailId?.ifscCode
                    });
                }
            }
        }

        res.json(uniqueExaminers);
    } catch (error) {
        console.error('Error fetching examiner details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching examiner details'
        });
    }
});

// Update bank details
app.put('/api/bank-details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedBankDetail = await BankDetails.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true }
        );

        if (!updatedBankDetail) {
            return res.status(404).json({
                success: false,
                message: 'Bank detail not found'
            });
        }

        res.json({
            success: true,
            data: updatedBankDetail
        });
    } catch (error) {
        console.error('Error updating bank details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get unique exam names
app.get('/api/exam-names', async (req, res) => {
    try {
        // Get unique exam names using distinct
        const examNames = await ExaminationDetails.distinct('examName');
        
        // Sort exam names in descending order (most recent first)
        const sortedExamNames = examNames.sort().reverse();

        res.json(sortedExamNames);
    } catch (error) {
        console.error('Error fetching exam names:', error);
        res.status(500).json({ error: 'Failed to fetch exam names' });
    }
});

// Get branches for selected exam name
app.get('/api/branches/:examName', async (req, res) => {
    try {
        const { examName } = req.params;
        const branches = await ExaminationDetails.distinct('branch', { examName });
        res.json(branches.sort());
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// Get dates for selected exam name and branch
app.get('/api/dates', async (req, res) => {
    try {
        const { examName, branch } = req.query;
        const query = { examName };
        if (branch && branch !== 'ALL') {
            query.branch = branch;
        }
        const dates = await ExaminationDetails.distinct('examDate', query);
        res.json(dates.sort());
    } catch (error) {
        console.error('Error fetching dates:', error);
        res.status(500).json({ error: 'Failed to fetch dates' });
    }
});

// Get examiner types for selected exam name, branch, and date
app.get('/api/examiner-types', async (req, res) => {
    try {
        const { examName, branch, date } = req.query;
        const query = { examName };
        if (branch && branch !== 'ALL') {
            query.branch = branch;
        }
        if (date && date !== 'ALL') {
            query.examDate = new Date(date);
        }
        const examinerTypes = await ExaminationDetails.distinct('examinerType', query);
        res.json(examinerTypes.sort());
    } catch (error) {
        console.error('Error fetching examiner types:', error);
        res.status(500).json({ error: 'Failed to fetch examiner types' });
    }
});

// Get filtered examination details
app.get('/api/examination-details/filter', async (req, res) => {
    try {
        const { examName, branch, date, examinerType } = req.query;
        
        // Build the query object
        const query = {};
        
        // Always filter by exam name if provided
        if (examName) {
            query.examName = examName;
        }
        
        // Add other filters only if they are provided and not 'ALL'
        if (branch && branch !== 'ALL') {
            query.branch = branch;
        }
        
        if (date && date !== 'ALL') {
            // Convert date string to Date object for comparison
            query.examDate = new Date(date);
        }
        
        if (examinerType && examinerType !== 'ALL') {
            query.examinerType = examinerType;
        }

        console.log('Filter query:', query); // Debug log

        const details = await ExaminationDetails.find(query)
            .populate('bankDetailId')
            .sort({ examDate: -1 });

        console.log(`Found ${details.length} records`); // Debug log

        res.json(details);
    } catch (error) {
        console.error('Error fetching examination details:', error);
        res.status(500).json({ error: 'Failed to fetch examination details' });
    }
});

// Get all branches
app.get('/api/branches', async (req, res) => {
    try {
        const branches = await ExaminationDetails.distinct('branch');
        res.json(branches);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// Get all examiner types
app.get('/api/examiner-types', async (req, res) => {
    try {
        const types = await ExaminationDetails.distinct('examinerType');
        res.json(types);
    } catch (error) {
        console.error('Error fetching examiner types:', error);
        res.status(500).json({ error: 'Failed to fetch examiner types' });
    }
});

// Get examiners by branch and type
app.get('/api/examiners', async (req, res) => {
    try {
        const { branch, examinerType } = req.query;
        if (!branch || !examinerType) {
            return res.status(400).json({ error: 'Branch and examiner type are required' });
        }

        const examiners = await ExaminationDetails.aggregate([
            {
                $match: { branch, examinerType }
            },
            {
                $lookup: {
                    from: 'bankdetails',
                    localField: 'bankDetailId',
                    foreignField: '_id',
                    as: 'bankDetails'
                }
            },
            {
                $unwind: {
                    path: '$bankDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$examinerName',
                    examinerName: { $first: '$examinerName' },
                    panCard: { $first: '$panCard' },
                    bankDetails: { $first: '$bankDetails' },
                    examinerType: { $first: '$examinerType' }
                }
            }
        ]);

        res.json(examiners);
    } catch (error) {
        console.error('Error fetching examiners:', error);
        res.status(500).json({ error: 'Failed to fetch examiners' });
    }
});

// Get examiner details by name
app.get('/api/examiners/:name', async (req, res) => {
    try {
        const examinerName = decodeURIComponent(req.params.name);
        const examiner = await ExaminationDetails.findOne({ examinerName })
            .populate('bankDetailId');
        
        if (!examiner) {
            return res.status(404).json({ error: 'Examiner not found' });
        }
        res.json(examiner);
    } catch (error) {
        console.error('Error fetching examiner:', error);
        res.status(500).json({ error: 'Failed to fetch examiner' });
    }
});

// Update examiner details
app.put('/api/examiners/:id', async (req, res) => {
    try {
        const { examinerName, panCard, bankDetails } = req.body;
        const examiner = await ExaminationDetails.findByIdAndUpdate(
            req.params.id,
            { examinerName, panCard, bankDetailId: bankDetails },
            { new: true }
        );
        res.json(examiner);
    } catch (error) {
        console.error('Error updating examiner:', error);
        res.status(500).json({ error: 'Failed to update examiner' });
    }
});

// Delete bank detail
app.delete('/api/bank-details/:id', async (req, res) => {
    try {
        await BankDetails.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting bank detail:', error);
        res.status(500).json({ error: 'Failed to delete bank detail' });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get current exam name from file
app.get('/api/current-exam-name', async (req, res) => {
    try {
        const data = await fs.readFile(EXAM_NAME_FILE, 'utf8');
        data2 = data.split("\n")
        res.json({ examName: data2[0], temp: data2[1] });
        console.log({ examName: data2[0], temp: data2[1] });
    } catch (error) {
        console.error('Error reading exam name:', error);
        res.status(500).json({ error: 'Failed to read exam name' });
    }
});

// Save exam name to file
app.post('/api/current-exam-name', async (req, res) => {
    try {
        const { examName } = req.body;
        if (!examName) {
            return res.status(400).json({ error: 'Exam name is required' });
        }
        
        data = examName + "\n" + "temp"
        await fs.writeFile(EXAM_NAME_FILE, data);
        // await fs.writeFile(EXAM_NAME_FILE, examName);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error saving exam name:', error);
        res.status(500).json({ error: 'Failed to save exam name' });
    }
});

// API endpoint for viva cover sheet
app.get('/api/viva-cover-sheet', async (req, res) => {
    try {
        const { examName, branch, examDate, examinerType } = req.query;
        
        // Build query based on parameters
        const query = { examName };
        
        if (branch && branch !== 'ALL') {
            query.branch = branch;
        }
        
        if (examDate && examDate !== 'ALL') {
            // Convert the date string to a Date object for comparison
            const searchDate = new Date(examDate);
            searchDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(searchDate);
            nextDay.setDate(nextDay.getDate() + 1);
            
            query.examDate = {
                $gte: searchDate,
                $lt: nextDay
            };
        }
        
        if (examinerType && examinerType !== 'ALL') {
            query.examinerType = examinerType;
        }

        // Fetch the data
        const data = await ExaminationDetails.find(query)
            .select('examDate semester branch subjectCode examinerType examinerName numberOfStudents')
            .sort({ examDate: 1 });

        res.json(data);
    } catch (error) {
        console.error('Error fetching viva cover sheet data:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching viva cover sheet data'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
