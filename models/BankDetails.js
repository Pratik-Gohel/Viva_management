const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    examinerName: {
        type: String,
        required: true
    },
    panCard: {
        type: String,
        required: false,
        match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    },
    bankName: {
        type: String,
        required: true
    },
    branchName: {
        type: String,
        required: true
    },
    branchCode: {
        type: String,
        required: true
    },
    accountNo: {
        type: String,
        required: true,
        minlength: 9,
        maxlength: 18
    },
    ifscCode: {
        type: String,
        required: true,
        match: /^[A-Z]{4}0[A-Z0-9]{6}$/
    }
}, {
    timestamps: true,
    collection: 'Bank_details'
});

// Create a unique compound index on examinerName and accountNo
bankDetailsSchema.index({ examinerName: 1, accountNo: 1 }, { unique: true });

module.exports = mongoose.model('BankDetails', bankDetailsSchema);
