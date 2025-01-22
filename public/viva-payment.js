document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = config.getApiBaseUrl();

    // DOM Elements
    const examNameSelect = document.getElementById('examName');
    const branchSelect = document.getElementById('branch');
    const examDateSelect = document.getElementById('examDate');
    const examinerTypeSelect = document.getElementById('examinerType');
    const applyFilterBtn = document.getElementById('applyFilter');
    const exportExcelBtn = document.getElementById('exportExcel');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const noDataMessage = document.getElementById('noDataMessage');
    const dataTable = document.getElementById('dataTable');

    let currentData = [];

    // Initialize exam names
    async function initializeExamNames() {
        try {
            showLoading();
            const response = await fetch(`${API_BASE_URL}/api/exam-names`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch exam names');
            }
            
            const examNames = await response.json();
            examNameSelect.innerHTML = '<option value="">Select Exam Name</option>';
            examNames.forEach(name => {
                const option = new Option(name, name);
                examNameSelect.appendChild(option);
            });

            hideLoading();
        } catch (error) {
            showError('Error loading exam names: ' + error.message);
        }
    }

    // Load branches based on exam name
    async function loadBranches(examName) {
        try {
            branchSelect.innerHTML = '<option value="">Select Branch</option><option value="ALL">All Branches</option>';
            branchSelect.disabled = true;
            examDateSelect.disabled = true;
            examinerTypeSelect.disabled = true;
            applyFilterBtn.disabled = true;

            if (!examName) return;

            const response = await fetch(`${API_BASE_URL}/api/branches/${encodeURIComponent(examName)}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch branches');
            }
            
            const branches = await response.json();
            branches.forEach(branch => {
                const option = new Option(branch, branch);
                branchSelect.appendChild(option);
            });

            branchSelect.disabled = false;
        } catch (error) {
            showError('Error loading branches: ' + error.message);
        }
    }

    // Load dates based on exam name and branch
    async function loadDates(examName, branch) {
        try {
            examDateSelect.innerHTML = '<option value="">Select Date</option><option value="ALL">All Dates</option>';
            examDateSelect.disabled = true;
            examinerTypeSelect.disabled = true;
            applyFilterBtn.disabled = true;

            if (!examName || !branch) return;

            const url = `${API_BASE_URL}/api/dates?examName=${encodeURIComponent(examName)}${branch !== 'ALL' ? `&branch=${encodeURIComponent(branch)}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch dates');
            }
            
            const dates = await response.json();
            dates.sort((a, b) => new Date(a) - new Date(b)).forEach(date => {
                const formattedDate = new Date(date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const option = new Option(formattedDate, date);
                examDateSelect.appendChild(option);
            });

            examDateSelect.disabled = false;
        } catch (error) {
            showError('Error loading dates: ' + error.message);
        }
    }

    // Load examiner types based on exam name, branch, and date
    async function loadExaminerTypes(examName, branch, date) {
        try {
            examinerTypeSelect.innerHTML = '<option value="">Select Type</option><option value="ALL">All Types</option>';
            examinerTypeSelect.disabled = true;
            applyFilterBtn.disabled = true;

            if (!examName || !branch || !date) return;

            const url = `${API_BASE_URL}/api/examiner-types?examName=${encodeURIComponent(examName)}${branch !== 'ALL' ? `&branch=${encodeURIComponent(branch)}` : ''}${date !== 'ALL' ? `&date=${encodeURIComponent(date)}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch examiner types');
            }
            
            const types = await response.json();
            types.forEach(type => {
                const option = new Option(type, type);
                examinerTypeSelect.appendChild(option);
            });

            examinerTypeSelect.disabled = false;
            applyFilterBtn.disabled = false;
        } catch (error) {
            showError('Error loading examiner types: ' + error.message);
        }
    }

    // Apply filters and fetch data
    async function applyFilters() {
        try {
            showLoading();
            exportExcelBtn.disabled = true;

            const filters = {
                examName: examNameSelect.value,
                branch: branchSelect.value,
                examDate: examDateSelect.value,
                examinerType: examinerTypeSelect.value
            };

            if (!filters.examName) {
                showError('Please select an exam name');
                return;
            }

            const queryParams = new URLSearchParams({
                examName: filters.examName,
                ...(filters.branch !== 'ALL' && { branch: filters.branch }),
                ...(filters.examDate !== 'ALL' && { date: filters.examDate }),
                ...(filters.examinerType !== 'ALL' && { examinerType: filters.examinerType })
            });

            const response = await fetch(`${API_BASE_URL}/api/examination-details/filter?${queryParams}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch data');
            }
            
            const data = await response.json();
            currentData = processData(data);

            if (currentData.length === 0) {
                showNoData();
                exportExcelBtn.disabled = true;
            } else {
                displayData(currentData);
                exportExcelBtn.disabled = false;
            }

            hideLoading();
        } catch (error) {
            showError('Error fetching data: ' + error.message);
            exportExcelBtn.disabled = true;
        }
    }

    // Process data for display and export
    function processData(data) {
        if (!data || data.length === 0) return [];

        // Sort by date
        data.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

        // Separate external examiners
        const externalExaminers = data.filter(item => item.examinerType === 'External');
        const internalStaff = data.filter(item => ['Internal', 'Lab Assistant', 'Peon'].includes(item.examinerType));

        // Group internal staff by name and sum their amounts
        const internalGroups = internalStaff.reduce((groups, item) => {
            const key = `${item.examinerName}-${item.bankDetailId?.accountNo || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    examinerName: item.examinerName,
                    bankDetails: item.bankDetailId,
                    totalAmount: 0, totalRecords: 0,
                    examDates: new Set(),
                    examinerType: item.examinerType
                };
            }
            groups[key].totalAmount += item.billAmount;
            groups[key].totalRecords += 1;
            groups[key].examDates.add(item.examDate);
            return groups;
        }, {});

        // Convert grouped data to array format
        return [
            ...externalExaminers.map(item => ({
                amount: item.billAmount,
                ifscCode: item.bankDetailId?.ifscCode || '',
                accountNo: item.bankDetailId?.accountNo || '',
                fixedCol1: '10',
                examinerName: item.examinerName,
                fixedCol2: 'Bhavnagar',
                fixedCol3: 'NEFT',
                fixedCol4: 'GEC',
                examDate: item.examDate,
                examinerType: 'External',
                totalRecords: 1
            })),
            ...Object.values(internalGroups).map(item => ({
                amount: item.totalAmount,
                ifscCode: item.bankDetails?.ifscCode || '',
                accountNo: item.bankDetails?.accountNo || '',
                fixedCol1: '10',
                examinerName: item.examinerName,
                fixedCol2: 'Bhavnagar',
                fixedCol3: 'NEFT',
                fixedCol4: 'GEC',
                examDate: Array.from(item.examDates).sort().join(', '),
                examinerType: item.examinerType,
                totalRecords: item.totalRecords
            }))
        ];
    }

    // Display data in table
    function displayData(data) {
        const tbody = dataTable.querySelector('tbody');
        tbody.innerHTML = '';

        data.forEach((item, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.amount}</td>
                <td>${item.ifscCode}</td>
                <td>${item.accountNo}</td>
                <td>${item.fixedCol1}</td>
                <td>${item.examinerName}</td>
                <td>${item.fixedCol2}</td>
                <td>${item.fixedCol3}</td>
                <td>${item.fixedCol4}</td>
                <td>${formatDate(item.examDate)}</td>
                <td>${item.examinerType}</td>
                <td>${item.totalRecords}</td>
            `;
        });

        dataTable.style.display = 'table';
    }

    // Format date for Excel (mm-dd-yyyy)
    function formatExcelDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${day}-${year}`;
    }

    // Export to Excel
    function exportToExcel() {
        if (!currentData || currentData.length === 0) {
            showError('No data to export');
            return;
        }

        const workbook = XLSX.utils.book_new();
        const worksheetData = currentData.map((item, index) => {
            return {
                'Sr. No.': index + 1,
                'Amount': item.amount,
                'IFSC Code': item.ifscCode,
                'Account No': item.accountNo,
                '---': item.fixedCol1,
                'Examiner Name': item.examinerName,
                'Location': item.fixedCol2,
                'Payment Mode': item.fixedCol3,
                'College': item.fixedCol4,
                'Exam Date': formatExcelDate(item.examDate),
                'Examiner Type': item.examinerType,
                'Total Records': item.totalRecords
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);

        // Set column widths
        const colWidths = [
            { wch: 8 },  // Sr. No.
            { wch: 12 }, // Amount
            { wch: 15 }, // IFSC Code
            { wch: 20 }, // Account No
            { wch: 12 }, // Fixed Col 1
            { wch: 30 }, // Examiner Name
            { wch: 15 }, // Fixed Col 2
            { wch: 10 }, // Fixed Col 3
            { wch: 10 }, // Fixed Col 4
            { wch: 15 }, // Exam Date
            { wch: 15 }, // Examiner Type
            { wch: 12 }  // Total Records
        ];
        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Viva Payments');

        // Generate filename with current date
        const today = new Date().toISOString().split('T')[0];
        const fileName = `viva_payments_${today}.xlsx`;

        XLSX.writeFile(workbook, fileName);
    }

    // Helper functions
    function showLoading() {
        loadingSpinner.style.display = 'block';
        errorMessage.style.display = 'none';
        noDataMessage.style.display = 'none';
        dataTable.style.display = 'none';
    }

    function hideLoading() {
        loadingSpinner.style.display = 'none';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        loadingSpinner.style.display = 'none';
        noDataMessage.style.display = 'none';
        dataTable.style.display = 'none';
    }

    function showNoData() {
        noDataMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        dataTable.style.display = 'none';
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        if (dateString.includes(',')) return dateString; // Return as is if it's a comma-separated list
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Event listeners
    examNameSelect.addEventListener('change', () => {
        loadBranches(examNameSelect.value);
        examDateSelect.innerHTML = '<option value="">Select Date</option>';
        examDateSelect.disabled = true;
        examinerTypeSelect.innerHTML = '<option value="">Select Type</option>';
        examinerTypeSelect.disabled = true;
        applyFilterBtn.disabled = true;
    });

    branchSelect.addEventListener('change', () => {
        if (examNameSelect.value && branchSelect.value) {
            loadDates(examNameSelect.value, branchSelect.value);
        }
    });

    examDateSelect.addEventListener('change', () => {
        if (examNameSelect.value && branchSelect.value && examDateSelect.value) {
            loadExaminerTypes(examNameSelect.value, branchSelect.value, examDateSelect.value);
        }
    });

    applyFilterBtn.addEventListener('click', applyFilters);
    exportExcelBtn.addEventListener('click', exportToExcel);

    // Initialize
    initializeExamNames();
});
