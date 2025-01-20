document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const branchSelect = document.getElementById('branch');
    const examinerTypeSelect = document.getElementById('examinerType');
    const loadExaminersBtn = document.getElementById('loadExaminers');
    const examinerModal = document.getElementById('examinerModal');
    const examinerList = document.getElementById('examinerList');
    const updateFormSection = document.getElementById('updateFormSection');
    const updateForm = document.getElementById('updateForm');
    const examinerNameInput = document.getElementById('examinerName');
    const panCardInput = document.getElementById('panCard');
    const bankDetailsList = document.getElementById('bankDetailsList');
    const addNewBankBtn = document.getElementById('addNewBank');
    const bankModal = document.getElementById('bankModal');
    const bankForm = document.getElementById('bankForm');
    const confirmModal = document.getElementById('confirmModal');

    let currentExaminer = null;
    let currentBankDetail = null;

    // Initialize branch and examiner type options
    async function initializeSelects() {
        try {
            const [branchResponse, typeResponse] = await Promise.all([
                fetch('/api/branches'),
                fetch('/api/examiner-types')
            ]);

            const branches = await branchResponse.json();
            const types = await typeResponse.json();

            branchSelect.innerHTML = '<option value="">Select Branch</option>' +
                branches.map(branch => `<option value="${branch}">${branch}</option>`).join('');

            examinerTypeSelect.innerHTML = '<option value="">Select Examiner Type</option>' +
                types.map(type => `<option value="${type}">${type}</option>`).join('');
        } catch (error) {
            console.error('Error initializing selects:', error);
            showToast('Error loading initial data', 'error');
        }
    }

    // Load examiners based on branch and type
    async function loadExaminers() {
        const branch = branchSelect.value;
        const examinerType = examinerTypeSelect.value;

        if (!branch || !examinerType) {
            showToast('Please select both Branch and Examiner Type', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/examiners?branch=${encodeURIComponent(branch)}&examinerType=${encodeURIComponent(examinerType)}`);
            const examiners = await response.json();

            examinerList.innerHTML = examiners.map(examiner => `
                <div class="examiner-item" data-examiner='${JSON.stringify(examiner)}'>
                    <div class="examiner-info">
                        <strong>${examiner.examinerName}</strong>
                        ${examiner.panCard ? `<br>PAN: ${examiner.panCard}` : ''}
                        <br>Bank Accounts: ${examiner.bankDetails?.length || 0}
                    </div>
                </div>
            `).join('') || '<p class="no-data">No examiners found</p>';

            examinerModal.style.display = 'block';

            // Add click handlers
            examinerList.querySelectorAll('.examiner-item').forEach(item => {
                item.addEventListener('click', () => {
                    const examiner = JSON.parse(item.dataset.examiner);
                    loadExaminerDetails(examiner);
                });
            });
        } catch (error) {
            console.error('Error loading examiners:', error);
            showToast('Error loading examiners', 'error');
        }
    }

    // Load examiner details for editing
    function loadExaminerDetails(examiner) {
        currentExaminer = examiner;
        examinerNameInput.value = examiner.examinerName;
        panCardInput.value = examiner.panCard || '';
        
        // Display bank details in a table format
        const bankDetailsHtml = examiner.bankDetails.map((bank, index) => `
            <div class="bank-detail-card" data-bank-id="${bank._id}">
                <div class="bank-header">
                    <h4>Bank Account ${index + 1}</h4>
                    ${examiner.bankDetails.length > 1 ? `
                        <button type="button" class="btn danger delete-bank">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
                <div class="bank-details-grid">
                    <div class="form-group">
                        <label>Bank Name:</label>
                        <input type="text" class="bank-name" value="${bank.bankName}" required>
                    </div>
                    <div class="form-group">
                        <label>Branch Name:</label>
                        <input type="text" class="bank-branch" value="${bank.branchName}" required>
                    </div>
                    <div class="form-group">
                        <label>Branch Code:</label>
                        <input type="text" class="bank-branch-code" value="${bank.branchCode}" required>
                    </div>
                    <div class="form-group">
                        <label>Account Number:</label>
                        <input type="text" class="account-no" value="${bank.accountNo}" required>
                    </div>
                    <div class="form-group">
                        <label>IFSC Code:</label>
                        <input type="text" class="ifsc-code" value="${bank.ifscCode}" required>
                    </div>
                </div>
            </div>
        `).join('');

        bankDetailsList.innerHTML = bankDetailsHtml;
        
        // Add event listeners for delete buttons
        bankDetailsList.querySelectorAll('.delete-bank').forEach(btn => {
            btn.addEventListener('click', () => {
                const bankCard = btn.closest('.bank-detail-card');
                showDeleteConfirmation(bankCard.dataset.bankId);
            });
        });

        examinerModal.style.display = 'none';
        updateFormSection.style.display = 'block';
    }

    // Display bank details in the list
    function displayBankDetails(bankDetails) {
        bankDetailsList.innerHTML = bankDetails.map((bank, index) => `
            <div class="bank-detail-card" data-bank-id="${bank._id}">
                <div class="bank-info">
                    <h4>Bank Account ${index + 1}</h4>
                    <div class="form-group">
                        <label>Bank Name:</label>
                        <input type="text" class="bank-name" value="${bank.bankName}" required>
                    </div>
                    <div class="form-group">
                        <label>Branch Name:</label>
                        <input type="text" class="bank-branch" value="${bank.branchName}" required>
                    </div>
                    <div class="form-group">
                        <label>Branch Code:</label>
                        <input type="text" class="bank-branch-code" value="${bank.branchCode}" required>
                    </div>
                    <div class="form-group">
                        <label>Account Number:</label>
                        <input type="text" class="account-no" value="${bank.accountNo}" required>
                    </div>
                    <div class="form-group">
                        <label>IFSC Code:</label>
                        <input type="text" class="ifsc-code" value="${bank.ifscCode}" required>
                    </div>
                </div>
                <div class="bank-actions">
                    <button type="button" class="btn danger delete-bank" ${bankDetails.length === 1 ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners for bank actions
        bankDetailsList.querySelectorAll('.delete-bank').forEach(btn => {
            btn.addEventListener('click', () => {
                if (bankDetails.length > 1) {
                    const bankCard = btn.closest('.bank-detail-card');
                    showDeleteConfirmation(bankCard.dataset.bankId);
                }
            });
        });
    }

    // Add new bank account
    function addNewBankAccount() {
        const newBank = {
            _id: 'new_' + Date.now(),
            bankName: '',
            branchName: '',
            branchCode: '',
            accountNo: '',
            ifscCode: ''
        };

        currentExaminer.bankDetails = currentExaminer.bankDetails || [];
        currentExaminer.bankDetails.push(newBank);
        displayBankDetails(currentExaminer.bankDetails);
        
        // Scroll to the new bank card
        const newBankCard = bankDetailsList.lastElementChild;
        newBankCard.scrollIntoView({ behavior: 'smooth' });
    }

    // Save all examiner details
    async function saveExaminerDetails(event) {
        event.preventDefault();

        if (!currentExaminer) return;

        try {
            // Gather all bank details
            const bankCards = bankDetailsList.querySelectorAll('.bank-detail-card');
            const updatedBanks = Array.from(bankCards).map(card => ({
                _id: card.dataset.bankId,
                bankName: card.querySelector('.bank-name').value,
                branchName: card.querySelector('.bank-branch').value,
                branchCode: card.querySelector('.bank-branch-code').value,
                accountNo: card.querySelector('.account-no').value,
                ifscCode: card.querySelector('.ifsc-code').value
            }));

            // Update examiner data
            const examinerData = {
                examinerName: examinerNameInput.value,
                panCard: panCardInput.value,
                bankDetails: updatedBanks
            };

            // Save all bank details first
            const bankPromises = updatedBanks.map(bank => {
                const isNew = bank._id.startsWith('new_');
                const url = isNew ? '/api/bank-details' : `/api/bank-details/${bank._id}`;
                const method = isNew ? 'POST' : 'PUT';

                return fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...bank, examinerName: examinerData.examinerName })
                });
            });

            await Promise.all(bankPromises);

            // Then update examiner
            const examinerResponse = await fetch(`/api/examiners/${encodeURIComponent(currentExaminer._id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(examinerData)
            });

            if (!examinerResponse.ok) {
                throw new Error('Failed to update examiner');
            }

            showToast('All details saved successfully', 'success');
            
            // Reload examiner details
            const updatedExaminer = await examinerResponse.json();
            loadExaminerDetails(updatedExaminer);
        } catch (error) {
            console.error('Error saving details:', error);
            showToast('Error saving details', 'error');
        }
    }

    // Delete bank detail
    async function deleteBankDetail(bankId) {
        if (!currentExaminer) return;

        try {
            if (!bankId.startsWith('new_')) {
                const response = await fetch(`/api/bank-details/${bankId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Failed to delete bank detail');
                }
            }

            currentExaminer.bankDetails = currentExaminer.bankDetails.filter(b => b._id !== bankId);
            displayBankDetails(currentExaminer.bankDetails);
            confirmModal.style.display = 'none';
            showToast('Bank detail deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting bank detail:', error);
            showToast('Error deleting bank detail', 'error');
        }
    }

    // Show toast message
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Event Listeners
    loadExaminersBtn.addEventListener('click', loadExaminers);
    addNewBankBtn.addEventListener('click', addNewBankAccount);
    updateForm.addEventListener('submit', saveExaminerDetails);
    document.getElementById('confirmDelete').addEventListener('click', () => {
        const bankId = document.getElementById('confirmDelete').dataset.bankId;
        deleteBankDetail(bankId);
    });
    document.getElementById('cancelDelete').addEventListener('click', () => {
        confirmModal.style.display = 'none';
    });

    // Show delete confirmation
    function showDeleteConfirmation(bankId) {
        document.getElementById('confirmDelete').dataset.bankId = bankId;
        confirmModal.style.display = 'block';
    }

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === examinerModal) examinerModal.style.display = 'none';
        if (event.target === confirmModal) confirmModal.style.display = 'none';
    });

    // Close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });

    // Initialize
    initializeSelects();
});
