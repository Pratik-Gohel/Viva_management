const mongoose = require('mongoose');

const examinationDetailsSchema = new mongoose.Schema({
    examName: {
        type: String,
        required: true
    },
    examDate: {
        type: Date,
        required: true
    },
    branch: {
        type: String,
        required: true
    },
    semester: {
        type: String,
        required: true
    },
    subjectCode: {
        type: String,
        required: true
    },
    examinerType: {
        type: String,
        required: true,
        enum: ['External', 'Internal', 'Lab Assistant', 'Peon']
    },
    examinerName: {
        type: String,
        required: true
    },
    mobileNo: {
        type: String,
        required: true,
        match: /^[0-9]{10}$/
    },
    panCard: {
        type: String,
        required: false,
        match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    },
    documentAttached: {
        type: String,
        enum: ['YES', 'NO'],
        default: 'NO',
        required: false
    },
    numberOfStudents: {
        type: Number,
        required: true,
        min: 0
    },
    taAmount: {
        type: Number,
        required: true,
        min: 0
    },
    daAmount: {
        type: Number,
        required: true,
        min: 0
    },
    honorarium: {
        type: Number,
        required: true,
        min: 0
    },
    billAmount: {
        type: Number,
        required: true,
        min: 0
    },
    bankDetailId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankDetails',
        required: true
    }
}, {
    timestamps: true,
    collection: 'Examination_details'
});

module.exports = mongoose.model('ExaminationDetails', examinationDetailsSchema);
