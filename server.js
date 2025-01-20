require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const ExaminationDetails = require('./models/ExaminationDetails');
const BankDetails = require('./models/BankDetails');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// MongoDB Connection with retry logic
async function connectToMongoDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
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

// API Routes
app.post('/api/examination-details', async (req, res) => {
    try {
        const {
            examName, examDate, branch, semester, subjectCode,
            examinerType, examinerName, panCard, mobileNo,
            numberOfStudents, taAmount, daAmount, honorarium,
            billAmount, bankDetailId
        } = req.body;

        // Validate required fields
        if (!examName || !examDate || !branch || !semester || !subjectCode ||
            !examinerType || !examinerName || !mobileNo ||
            !numberOfStudents || !bankDetailId) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }

        // Validate bankDetailId exists
        const bankDetailExists = await BankDetails.findById(bankDetailId);
        if (!bankDetailExists) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bank detail ID'
            });
        }

        // Validate PAN Card format if provided
        if (panCard && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCard)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid PAN Card format'
            });
        }

        // Create examination details
        const examinationDetails = new ExaminationDetails({
            examName,
            examDate,
            branch,
            semester,
            subjectCode,
            examinerType,
            examinerName,
            panCard,  // This will be undefined if not provided
            mobileNo,
            numberOfStudents,
            taAmount: taAmount || 0,
            daAmount: daAmount || 0,
            honorarium: honorarium || 0,
            billAmount: billAmount || 0,
            bankDetailId
        });

        const savedExamDetails = await examinationDetails.save();
        
        res.status(201).json({
            success: true,
            message: 'Examination details saved successfully',
            data: savedExamDetails
        });
    } catch (error) {
        console.error('Error saving examination details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to save examination details'
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
        const examNames = await ExaminationDetails.distinct('examName');
        res.json(examNames.sort());
    } catch (error) {
        console.error('Error fetching exam names:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get branches by exam name
app.get('/api/branches/:examName', async (req, res) => {
    try {
        const { examName } = req.params;
        const branches = await ExaminationDetails.distinct('branch', { examName });
        res.json(branches.sort());
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).json({ success: false, message: error.message });
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
        res.status(500).json({ success: false, message: error.message });
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

        if (!branch || !examinerType) {
            return res.status(400).json({
                success: false,
                message: 'Branch and examiner type are required'
            });
        }

        // Find unique examiner details
        const examiners = await ExaminationDetails.aggregate([
            {
                $match: {
                    branch: branch,
                    examinerType: examinerType
                }
            },
            {
                $sort: {
                    updatedAt: -1
                }
            },
            {
                $group: {
                    _id: {
                        examinerName: '$examinerName',
                        examinerType: '$examinerType'
                    },
                    bankDetailId: { $first: '$bankDetailId' },
                    panCard: { $first: '$panCard' },
                    lastUpdated: { $first: '$updatedAt' }
                }
            },
            {
                $lookup: {
                    from: 'Bank_details',
                    localField: 'bankDetailId',
                    foreignField: '_id',
                    as: 'bankDetail'
                }
            },
            {
                $unwind: {
                    path: '$bankDetail',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    examinerName: '$_id.examinerName',
                    examinerType: '$_id.examinerType',
                    bankDetailId: 1,
                    panCard: 1,
                    bankName: '$bankDetail.bankName',
                    branchName: '$bankDetail.branchName',
                    branchCode: '$bankDetail.branchCode',
                    accountNo: '$bankDetail.accountNo',
                    ifscCode: '$bankDetail.ifscCode',
                    lastUpdated: 1
                }
            },
            {
                $sort: {
                    lastUpdated: -1,
                    examinerName: 1
                }
            }
        ]);

        console.log('Found examiners:', examiners);
        res.json(examiners);
    } catch (error) {
        console.error('Error fetching examiner details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch examiner details'
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
app.get('/api/examination-details/exam-names', async (req, res) => {
    try {
        const examNames = await ExaminationDetails.distinct('examName');
        res.json(examNames);
    } catch (error) {
        console.error('Error fetching exam names:', error);
        res.status(500).json({ error: 'Failed to fetch exam names' });
    }
});

// Get branches for a specific exam
app.get('/api/examination-details/branches', async (req, res) => {
    try {
        const { examName } = req.query;
        if (!examName) {
            return res.status(400).json({ error: 'Exam name is required' });
        }

        const branches = await ExaminationDetails.distinct('branch', { examName });
        res.json(branches);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// Get dates for a specific exam and branch
app.get('/api/examination-details/dates', async (req, res) => {
    try {
        const { examName, branch } = req.query;
        if (!examName) {
            return res.status(400).json({ error: 'Exam name is required' });
        }

        const query = { examName };
        if (branch && branch !== 'all') {
            query.branch = branch;
        }

        const dates = await ExaminationDetails.distinct('examDate', query);
        res.json(dates);
    } catch (error) {
        console.error('Error fetching dates:', error);
        res.status(500).json({ error: 'Failed to fetch dates' });
    }
});

// Get examiner types for specific exam, branch, and date
app.get('/api/examination-details/examiner-types', async (req, res) => {
    try {
        const { examName, branch, date } = req.query;
        if (!examName) {
            return res.status(400).json({ error: 'Exam name is required' });
        }

        const query = { examName };
        if (branch && branch !== 'all') {
            query.branch = branch;
        }
        if (date && date !== 'all') {
            query.examDate = date;
        }

        const examinerTypes = await ExaminationDetails.distinct('examinerType', query);
        res.json(examinerTypes);
    } catch (error) {
        console.error('Error fetching examiner types:', error);
        res.status(500).json({ error: 'Failed to fetch examiner types' });
    }
});

// Get filtered examination details
app.get('/api/examination-details/filter', async (req, res) => {
    try {
        const { examName, branch, date, examinerType } = req.query;
        if (!examName) {
            return res.status(400).json({ error: 'Exam name is required' });
        }

        const query = { examName };
        if (branch && branch !== 'all') {
            query.branch = branch;
        }
        if (date && date !== 'all') {
            query.examDate = date;
        }
        if (examinerType && examinerType !== 'all') {
            query.examinerType = examinerType;
        }

        const details = await ExaminationDetails.find(query)
            .populate('bankDetailId')
            .sort('examDate')
            .lean();

        const formattedDetails = details.map(detail => ({
            ...detail,
            bankDetails: detail.bankDetailId,
            bankDetailId: detail.bankDetailId?._id
        }));

        res.json(formattedDetails);
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

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
