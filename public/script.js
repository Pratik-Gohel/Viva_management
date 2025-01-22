document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = config.getApiBaseUrl();

    // Show login modal on page load if not already logged in
    if (!sessionStorage.getItem('isLoggedIn')) {
        const loginModal = document.getElementById('loginModal');
        loginModal.style.display = 'block';
    }

    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                sessionStorage.setItem('isLoggedIn', 'true');
                document.getElementById('loginModal').style.display = 'none';
                showToast('Login successful', 'success');
            } else {
                showToast('Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Login failed', 'error');
        }
    });

    const form = document.getElementById('vivaForm');
    const examNameInput = document.getElementById('examName');
    const examDateInput = document.getElementById('examDate');
    const branchSelect = document.getElementById('branch');
    const semesterSelect = document.getElementById('semester');
    const subjectCodeInput = document.getElementById('subjectCode');
    const examinerTypeSelect = document.getElementById('examinerType');
    const examinerNameInput = document.getElementById('examinerName');
    const panCardInput = document.getElementById('panCard');
    const mobileNoInput = document.getElementById('mobileNo');
    const numberOfStudentsInput = document.getElementById('studentCount');
    const taAmountInput = document.getElementById('taAmount');
    const daAmountInput = document.getElementById('daAmount');
    const honorariumInput = document.getElementById('honorarium');
    const billAmountInput = document.getElementById('billAmount');
    const bankNameInput = document.getElementById('bankName');
    const bankBranchInput = document.getElementById('bankBranch');
    const bankBranchCodeInput = document.getElementById('bankBranchCode');
    const accountNoInput = document.getElementById('accountNo');
    const ifscCodeInput = document.getElementById('ifscCode');
    const editBankDetailsBtn = document.getElementById('editBankDetails');
    const examinerModal = document.getElementById('examinerModal');
    const examinerDetailsList = document.getElementById('examinerDetailsList');
    const loadExaminerBtn = document.getElementById('loadExaminerDetails');

    let selectedBankDetailId = null;
    let originalBankDetails = null;

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Add show class after a small delay to trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    function toggleBankFieldsDisabled(disabled) {
        const bankFields = [
            bankNameInput,
            bankBranchInput,
            bankBranchCodeInput,
            accountNoInput,
            ifscCodeInput
        ];

        bankFields.forEach(field => {
            field.disabled = disabled;
        });
    }

    async function loadExaminerDetails() {
        const branch = branchSelect.value;
        const examinerType = examinerTypeSelect.value;
        
        

        console.log('Loading examiners with:', { branch, examinerType });

        if (!branch || !examinerType) {
            showToast('Please select both Branch and Examiner Type first', 'warning');
            return;
        }

        try {
            showLoadingInList();
            
            const url = `${API_BASE_URL}/api/examiner-details?branch=${encodeURIComponent(branch)}&examinerType=${encodeURIComponent(examinerType)}`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch examiner details');
            }

            const data = await response.json();
            console.log('Received data:', data);

            if (!data || data.length === 0) {
                showToast('Examiner details not found', 'info');
                hideLoadingInList();
                examinerModal.style.display = 'none';
                return;
            }

            // Display examiner list
            examinerDetailsList.innerHTML = data.map((examiner, index) => `
                <div class="examiner-item" data-index="${index}">
                    <div class="examiner-name">${examiner.examinerName} - ${examiner.examinerType}</div>
                    <div class="examiner-details">
                        ${examiner.panCard ? `${examiner.panCard},` : ''}
                        ${examiner.mobileNo ? `${examiner.mobileNo}` : ''}
                    </div>
                </div>
            `).join('');

            // Add click handlers for examiner items
            examinerDetailsList.querySelectorAll('.examiner-item').forEach((item, index) => {
                item.addEventListener('click', () => {
                    const selectedExaminer = data[index];
                    console.log('Selected examiner:', selectedExaminer);
                    
                    // Clear all fields first
                    clearExaminerFields();
                    
                    // Fill in examiner details
                    examinerNameInput.value = selectedExaminer.examinerName;
                    if (selectedExaminer.mobileNo) {
                        mobileNoInput.value = selectedExaminer.mobileNo;
                    }
                    if (selectedExaminer.panCard) {
                        panCardInput.value = selectedExaminer.panCard;
                    }
                    
                    // Fill in bank details if available
                    if (selectedExaminer.bankDetailId) {
                        // Store original bank details for comparison
                        originalBankDetails = {
                            bankName: selectedExaminer.bankName || '',
                            branchName: selectedExaminer.branchName || '',
                            branchCode: selectedExaminer.branchCode || '',
                            accountNo: selectedExaminer.accountNo || '',
                            ifscCode: selectedExaminer.ifscCode || ''
                        };

                        // Fill in the fields
                        bankNameInput.value = originalBankDetails.bankName;
                        bankBranchInput.value = originalBankDetails.branchName;
                        bankBranchCodeInput.value = originalBankDetails.branchCode;
                        accountNoInput.value = originalBankDetails.accountNo;
                        ifscCodeInput.value = originalBankDetails.ifscCode;

                        selectedBankDetailId = selectedExaminer.bankDetailId;
                        editBankDetailsBtn.style.display = 'inline-block';
                        
                        // Disable bank detail fields by default
                        toggleBankFieldsDisabled(true);
                    } else {
                        // Clear bank details if not available
                        clearBankDetails();
                        editBankDetailsBtn.style.display = 'none';
                        toggleBankFieldsDisabled(false);
                    }
                    
                    // Close the modal
                    examinerModal.style.display = 'none';
                });
            });

            examinerModal.style.display = 'block';
            hideLoadingInList();
        } catch (error) {
            console.error('Error loading examiner details:', error);
            showToast('Error loading examiner details', 'error');
            hideLoadingInList();
            examinerModal.style.display = 'none';
        }
    }

    async function populateExaminerList() {
        const branch = branchSelect.value;
        const examinerType = examinerTypeSelect.value;

        if (!branch || !examinerType) {
            showToast('Please select both Branch and Examiner Type first', 'warning');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/examiners?branch=${encodeURIComponent(branch)}&examinerType=${encodeURIComponent(examinerType)}`);
            const examiners = await response.json();
            
            const examinerSelect = document.getElementById('examinerName');
            examinerSelect.innerHTML = '<option value="">Select Examiner</option>';
            
            // Create a map to store all bank accounts for each examiner
            const examinerBankMap = new Map();

            examiners.forEach(examiner => {
                if (examiner.bankDetails && examiner.bankDetails.length > 0) {
                    examiner.bankDetails.forEach(bank => {
                        const displayText = `${examiner.examinerName} - ${bank.bankName} (${bank.accountNo})`;
                        
                        if (!examinerBankMap.has(examiner.examinerName)) {
                            examinerBankMap.set(examiner.examinerName, []);
                        }
                        examinerBankMap.get(examiner.examinerName).push({
                            displayText,
                            bankId: bank._id
                        });
                    });
                } else {
                    // If no bank details, just add examiner name
                    examinerBankMap.set(examiner.examinerName, [{
                        displayText: examiner.examinerName,
                        bankId: null
                    }]);
                }
            });

            // Add options for each bank account
            examinerBankMap.forEach((bankAccounts, examinerName) => {
                bankAccounts.forEach(account => {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({
                        name: examinerName,
                        bankId: account.bankId
                    });
                    option.textContent = account.displayText;
                    examinerSelect.appendChild(option);
                });
            });
        } catch (error) {
            console.error('Error loading examiners:', error);
            showToast('Error loading examiner list', 'error');
        }
    }

    // Update the examiner selection handler
    const examinerSelect = document.getElementById('examinerName');
    examinerSelect.addEventListener('change', async function() {
        //const examinerName = document.getElementById('examinerName').value;
        //console.log("name", examinerName);
        if (!this.value) {
            clearExaminerFields();
            return;
        }
        
        try {
            const { name, bankId } = JSON.parse(this.value);
            const examiner = await fetchExaminerDetails(name);
            
            if (bankId) {
                // If a specific bank was selected, pre-select it
                const selectedBank = examiner.bankDetails.find(b => b._id === bankId);
                if (selectedBank) {
                    document.getElementById('bankName').value = selectedBank.bankName;
                    document.getElementById('bankBranch').value = selectedBank.branchName;
                    document.getElementById('bankBranchCode').value = selectedBank.branchCode || '';
                    document.getElementById('accountNo').value = selectedBank.accountNo;
                    document.getElementById('ifscCode').value = selectedBank.ifscCode;
                    selectedBankDetailId = selectedBank._id;
                }
            }
            
            // Fill examiner details
            document.getElementById('panCard').value = examiner.panCard || '';
            document.getElementById('mobileNo').value = examiner.mobileNo || '';
            
            // Disable bank fields after auto-fill
            toggleBankFieldsDisabled(true);
            
            // Store original bank details for comparison
            originalBankDetails = {
                bankName: document.getElementById('bankName').value,
                bankBranch: document.getElementById('bankBranch').value,
                bankBranchCode: document.getElementById('bankBranchCode').value,
                accountNo: document.getElementById('accountNo').value,
                ifscCode: document.getElementById('ifscCode').value
            };
        } catch (error) {
            const examinerName = this.value; //document.getElementById('examinerName').value;
            console.log("name", examinerName);
            console.error('Error loading examiner details:', error);
            showToast('Error loading examiner details', 'error');
            clearExaminerFields();
            document.getElementById('examinerName').value = examinerName;
        }
    });

    async function fetchExaminerDetails(examinerName) {
        const response = await fetch(`${API_BASE_URL}/api/examiners/${encodeURIComponent(examinerName)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch examiner details');
        }
        return response.json();
    }

    function showLoadingInList() {
        examinerDetailsList.innerHTML = `
            <div class="loading-message">
                <div class="loading-spinner"></div>
                <p>Loading examiners...</p>
            </div>
        `;
        examinerModal.style.display = 'block';
    }

    function hideLoadingInList() {
        const loadingMessage = examinerDetailsList.querySelector('.loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
    }

    function clearBankDetails() {
        bankNameInput.value = '';
        bankBranchInput.value = '';
        bankBranchCodeInput.value = '';
        accountNoInput.value = '';
        ifscCodeInput.value = '';
        if (panCardInput) {
            panCardInput.value = '';
        }
        selectedBankDetailId = null;
        originalBankDetails = null;
    }

    // Function to clear examiner fields
    function clearExaminerFields() {
        // Keep exam name from current input
        const currentExamName = document.getElementById('examName').value;
        
        // Clear examiner details
        document.getElementById('examinerName').value = '';
        document.getElementById('mobileNo').value = '';
        document.getElementById('panCard').value = '';
        document.getElementById('studentCount').value = '';
        document.getElementById('taAmount').value = '';
        document.getElementById('daAmount').value = '';
        document.getElementById('honorarium').value = '';
        document.getElementById('billAmount').value = '';
        document.getElementById('documentAttached').checked = false;
        
        // Clear bank details
        document.getElementById('bankName').value = '';
        document.getElementById('bankBranch').value = '';
        document.getElementById('bankBranchCode').value = '';
        document.getElementById('accountNo').value = '';
        document.getElementById('ifscCode').value = '';
        
        // Reset bank details state
        selectedBankDetailId = null;
        originalBankDetails = null;
        editBankDetailsBtn.style.display = 'none';
        toggleBankFieldsDisabled(false);

        // Restore exam name
        document.getElementById('examName').value = currentExamName;
    }

    // Function to reset auto-filled fields
    function resetAutoFilledFields() {
        // Reset examiner details
        document.getElementById('examinerName').value = '';
        document.getElementById('mobileNo').value = '';
        document.getElementById('panCard').value = '';
        document.getElementById('studentCount').value = '';
        document.getElementById('taAmount').value = '';
        document.getElementById('daAmount').value = '';
        document.getElementById('honorarium').value = '';
        document.getElementById('billAmount').value = '';
        document.getElementById('documentAttached').checked = false;
        
        // Reset bank details
        document.getElementById('bankName').value = '';
        document.getElementById('bankBranch').value = '';
        document.getElementById('bankBranchCode').value = '';
        document.getElementById('accountNo').value = '';
        document.getElementById('ifscCode').value = '';
        
        // Reset bank details state
        selectedBankDetailId = null;
        originalBankDetails = null;
        if (editBankDetailsBtn) {
            editBankDetailsBtn.style.display = 'none';
        }
        toggleBankFieldsDisabled(false);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        try {
            // First check if bank details have been modified
            let bankDetailId = selectedBankDetailId;
            
            if (bankDetailId) {
                // Check if bank details were modified
                const currentBankDetails = {
                    bankName: bankNameInput.value,
                    branchName: bankBranchInput.value,
                    branchCode: bankBranchCodeInput.value,
                    accountNo: accountNoInput.value,
                    ifscCode: ifscCodeInput.value
                };

                const detailsChanged = Object.keys(currentBankDetails).some(key => 
                    currentBankDetails[key] !== originalBankDetails[key]
                );

                if (detailsChanged) {
                    // Create new bank details entry
                    const bankData = {
                        examinerName: examinerNameInput.value,
                        ...currentBankDetails
                    };

                    const bankResponse = await fetch(`${API_BASE_URL}/api/bank-details`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(bankData)
                    });

                    if (!bankResponse.ok) {
                        const bankError = await bankResponse.json();
                        throw new Error(bankError.message || 'Failed to save bank details');
                    }

                    const bankResult = await bankResponse.json();
                    bankDetailId = bankResult.data._id;
                }
            } else {
                // No existing bank details, create new entry
                if (!bankNameInput.value || !bankBranchInput.value || !bankBranchCodeInput.value || 
                    !accountNoInput.value || !ifscCodeInput.value) {
                    throw new Error('All bank details are required');
                }

                const bankData = {
                    examinerName: examinerNameInput.value,
                    bankName: bankNameInput.value,
                    branchName: bankBranchInput.value,
                    branchCode: bankBranchCodeInput.value,
                    accountNo: accountNoInput.value,
                    ifscCode: ifscCodeInput.value.toUpperCase()
                };

                const bankResponse = await fetch(`${API_BASE_URL}/api/bank-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bankData)
                });

                if (!bankResponse.ok) {
                    const bankError = await bankResponse.json();
                    throw new Error(bankError.message || 'Failed to save bank details');
                }

                const bankResult = await bankResponse.json();
                bankDetailId = bankResult.data._id;
            }

            // Now save examination details
            const formData = {
                examName: document.getElementById('examName').value,
                examDate: examDateInput.value,
                branch: branchSelect.value,
                semester: semesterSelect.value,
                subjectCode: subjectCodeInput.value,
                examinerType: examinerTypeSelect.value,
                examinerName: examinerNameInput.value,
                mobileNo: mobileNoInput.value,
                numberOfStudents: parseInt(numberOfStudentsInput.value) || 0,
                taAmount: parseFloat(taAmountInput.value) || 0,
                daAmount: parseFloat(daAmountInput.value) || 0,
                honorarium: parseFloat(honorariumInput.value) || 0,
                billAmount: parseFloat(billAmountInput.value) || 0,
                bankDetailId: bankDetailId,
                documentAttached: document.getElementById('documentAttached').checked ? 'YES' : 'NO'
            };

            // Only add PAN Card if it's not empty and the input exists
            if (panCardInput && panCardInput.value.trim()) {
                formData.panCard = panCardInput.value.trim().toUpperCase();
            }

            const examResponse = await fetch(`${API_BASE_URL}/api/examination-details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!examResponse.ok) {
                const examError = await examResponse.json();
                throw new Error(examError.message || 'Failed to save examination details');
            }

            const examResult = await examResponse.json();
            
            if (!examResult.success) {
                throw new Error(examResult.message || 'Failed to save examination details');
            }

            showToast('Details saved successfully!', 'success');
            
            // Clear form but preserve exam name
            const currentExamName = document.getElementById('examName').value;
            form.reset();
            clearBankDetails();
            editBankDetailsBtn.style.display = 'none';
            toggleBankFieldsDisabled(false);
            document.getElementById('examName').value = currentExamName;
        } catch (error) {
            console.error('Error saving details:', error);
            showToast('Error: ' + error.message, 'error');
        }
    }

    // Calculate bill amount when TA, DA, or Honorarium changes
    function calculateBillAmount() {
        const ta = parseFloat(taAmountInput.value) || 0;
        const da = parseFloat(daAmountInput.value) || 0;
        const honorarium = parseFloat(honorariumInput.value) || 0;
        
        const total = ta + da + honorarium;
        billAmountInput.value = total.toFixed(2);
    }

    // Add event listeners for amount calculations
    taAmountInput.addEventListener('input', calculateBillAmount);
    daAmountInput.addEventListener('input', calculateBillAmount);
    honorariumInput.addEventListener('input', calculateBillAmount);

    // Event Listeners
    loadExaminerBtn.addEventListener('click', loadExaminerDetails);

    // Branch code mapping
    const branchCodeMap = {
        'EC': '11',
        'IT': '16',
        'CE': '7',
        'MECH': '19',
        'CIVIL': '6',
        'ICT': '32'
    };

    // Set current date in exam date field
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('examDate').value = today;

    // Handle branch change
    branchSelect.addEventListener('change', function() {
        const selectedBranch = this.value.toUpperCase();
        const branchCode = branchCodeMap[selectedBranch] || '';
        document.getElementById('branchCode').value = branchCode;

        // Reset auto-filled fields when branch changes
        resetAutoFilledFields();
    });

    // Handle examiner type change
    examinerTypeSelect.addEventListener('change', async function() {
        // Reset auto-filled fields when examiner type changes
        resetAutoFilledFields();

        const branch = branchSelect.value;
        const examinerType = this.value;

        // Reset examiner select dropdown
        examinerSelect.innerHTML = '<option value="">Select Examiner</option>';
        examinerNameInput.value = '';
        
        if (!branch || !examinerType) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/examiners?branch=${encodeURIComponent(branch)}&examinerType=${encodeURIComponent(examinerType)}`);
            const examiners = await response.json();

            // Group examiners by name and collect all their bank accounts
            const examinerGroups = {};
            examiners.forEach(examiner => {
                if (!examinerGroups[examiner.examinerName]) {
                    examinerGroups[examiner.examinerName] = {
                        name: examiner.examinerName,
                        bankAccounts: []
                    };
                }
                if (examiner.bankDetails && examiner.bankDetails.length > 0) {
                    examinerGroups[examiner.examinerName].bankAccounts.push(...examiner.bankDetails);
                }
            });

            // Create options for each examiner-bank combination
            Object.values(examinerGroups).forEach(group => {
                if (group.bankAccounts.length > 0) {
                    // Add an option for each bank account
                    group.bankAccounts.forEach(bank => {
                        const option = document.createElement('option');
                        option.value = JSON.stringify({
                            name: group.name,
                            bankId: bank._id
                        });
                        option.textContent = `${group.name} - ${bank.bankName} (${bank.accountNo})`;
                        examinerSelect.appendChild(option);
                    });
                } else {
                    // Add a single option for examiner without bank details
                    const option = document.createElement('option');
                    option.value = JSON.stringify({
                        name: group.name,
                        bankId: null
                    });
                    option.textContent = group.name;
                    examinerSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Error loading examiners:', error);
            showToast('Error loading examiner list', 'error');
        }
    });

    // Handle examiner selection change
    examinerSelect.addEventListener('change', async function() {
        const examinerName = document.getElementById('examinerName').value;
        console.log('name' );
        //document.getElementById('examinerName').value = examinerName;

        if (!this.value) {
            resetAutoFilledFields();
            return;
        }

        try {
            const { name, bankId } = JSON.parse(this.value);
            examinerNameInput.value = name;

            if (bankId) {
                const response = await fetch(`${API_BASE_URL}/api/bank-details/${bankId}`);
                const bankDetails = await response.json();

                if (bankDetails) {
                    document.getElementById('bankName').value = bankDetails.bankName || '';
                    document.getElementById('bankBranch').value = bankDetails.bankBranch || '';
                    document.getElementById('bankBranchCode').value = bankDetails.bankBranchCode || '';
                    document.getElementById('accountNo').value = bankDetails.accountNo || '';
                    document.getElementById('ifscCode').value = bankDetails.ifscCode || '';
                    selectedBankDetailId = bankDetails._id;
                    editBankDetailsBtn.style.display = 'inline-block';
                    toggleBankFieldsDisabled(true);
                }
            } else {
                resetAutoFilledFields();
            }
        } catch (error) {
            console.error('Error loading bank details:', error);
            showToast('Error loading bank details', 'error');
            resetAutoFilledFields();
        }
    });

    // Close button functionality for examiner modal
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Handle document attached checkbox
    document.getElementById('documentAttached').addEventListener('change', function() {
        this.value = this.checked ? 'YES' : 'NO';
    });

    // Handle form submission
    form.addEventListener('submit', handleSubmit);

    async function loadCurrentExamName() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/current-exam-name`);
            const data = await response.json();
            if (data.examName) {
                examNameInput.value = data.examName;
            }
        } catch (error) {
            console.error('Error loading exam name:', error);
            showToast('Failed to load exam name', 'error');
        }
    }

    async function saveExamName(examName) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/current-exam-name`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ examName })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Exam name saved successfully', 'success');
            } else {
                throw new Error(data.error || 'Failed to save exam name');
            }
        } catch (error) {
            console.error('Error saving exam name:', error);
            showToast('Failed to save exam name', 'error');
            // Revert to previous value on error
            loadCurrentExamName();
        }
    }

    // Load exam name when page loads
    loadCurrentExamName();

    // Handle exam name edit
    const editExamNameBtn = document.getElementById('editExamName');
    editExamNameBtn.addEventListener('click', async function() {
        const examNameInput = document.getElementById('examName');
        examNameInput.readOnly = !examNameInput.readOnly;
        
        // Toggle icon between edit and save
        if (!examNameInput.readOnly) {
            this.classList.remove('fa-edit');
            this.classList.add('fa-save');
            examNameInput.focus();
        } else {
            this.classList.remove('fa-save');
            this.classList.add('fa-edit');
            // Save the value when clicking save icon
            await saveExamName(examNameInput.value);
        }
    });

    // Handle exam name input blur
    examNameInput.addEventListener('blur', function() {
        if (!this.readOnly) {
            editExamNameBtn.click(); // This will trigger save
        }
    });

    // Handle examiner selection
    examinerNameInput.addEventListener('change', async function() {
        const selectedExaminer = this.value;
        if (!selectedExaminer) {
            clearExaminerFields();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/examiners/${encodeURIComponent(selectedExaminer)}`);
            if (!response.ok) throw new Error('Failed to fetch examiner details');
            
            const examinerData = await response.json();
            
            // Set the mobile number
            document.getElementById('mobileNo').value = examinerData.mobileNo || '';
            
            // Set other examiner details if they exist
            document.getElementById('panCard').value = examinerData.panCard || '';
            
            // Set bank details if they exist
            if (examinerData.bankDetails) {
                document.getElementById('accountNo').value = examinerData.bankDetails.accountNo || '';
                document.getElementById('bankName').value = examinerData.bankDetails.bankName || '';
                document.getElementById('branchName').value = examinerData.bankDetails.branchName || '';
                document.getElementById('ifscCode').value = examinerData.bankDetails.ifscCode || '';
            }
        } catch (error) {
            console.error('Error fetching examiner details:', error);
            showToast('Failed to fetch examiner details', 'error');
        }
    });
});
