document.addEventListener('DOMContentLoaded', function() {
    // Filter elements
    const examNameFilter = document.getElementById('examNameFilter');
    const branchFilter = document.getElementById('branchFilter');
    const examDateFilter = document.getElementById('examDateFilter');
    const examinerTypeFilter = document.getElementById('examinerTypeFilter');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const exportExcelBtn = document.getElementById('exportExcel');

    // Table elements
    const dataTable = document.getElementById('dataTable');
    const loadingMessage = document.querySelector('.loading-message');
    const errorMessage = document.querySelector('.error-message');
    const noDataMessage = document.querySelector('.no-data-message');

    let currentData = [];

    // Initialize exam names
    async function initializeExamNames() {
        try {
            showLoading();
            const response = await fetch('/api/exam-names');
            if (!response.ok) throw new Error('Failed to fetch exam names');
            
            const examNames = await response.json();
            examNames.forEach(name => {
                const option = new Option(name, name);
                examNameFilter.appendChild(option);
            });

            hideLoading();
        } catch (error) {
            showError('Error loading exam names: ' + error.message);
        }
    }

    // Load branches based on exam name
    async function loadBranches(examName) {
        try {
            branchFilter.innerHTML = `
                <option value="">Select Branch</option>
                <option value="ALL">All Branches</option>
            `;
            branchFilter.disabled = true;
            examDateFilter.disabled = true;
            examinerTypeFilter.disabled = true;
            applyFiltersBtn.disabled = true;

            if (!examName) return;

            const response = await fetch(`/api/branches/${encodeURIComponent(examName)}`);
            if (!response.ok) throw new Error('Failed to fetch branches');
            
            const branches = await response.json();
            branches.forEach(branch => {
                const option = new Option(branch, branch);
                branchFilter.appendChild(option);
            });

            branchFilter.disabled = false;
        } catch (error) {
            showError('Error loading branches: ' + error.message);
        }
    }

    // Load dates based on exam name and branch
    async function loadDates(examName, branch) {
        try {
            examDateFilter.innerHTML = `
                <option value="">Select Date</option>
                <option value="ALL">All Dates</option>
            `;
            examDateFilter.disabled = true;
            examinerTypeFilter.disabled = true;
            applyFiltersBtn.disabled = true;

            if (!examName || !branch) return;

            const response = await fetch(`/api/dates/${encodeURIComponent(examName)}/${encodeURIComponent(branch)}`);
            if (!response.ok) throw new Error('Failed to fetch dates');
            
            const dates = await response.json();
            dates.forEach(date => {
                const formattedDate = new Date(date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const option = new Option(formattedDate, date);
                examDateFilter.appendChild(option);
            });

            examDateFilter.disabled = false;
        } catch (error) {
            showError('Error loading dates: ' + error.message);
        }
    }

    // Load examiner types based on exam name, branch, and date
    async function loadExaminerTypes(examName, branch, date) {
        try {
            examinerTypeFilter.innerHTML = `
                <option value="">Select Type</option>
                <option value="ALL">All Types</option>
            `;
            examinerTypeFilter.disabled = true;
            applyFiltersBtn.disabled = true;

            if (!examName || !branch || !date) return;

            const response = await fetch(`/api/examiner-types/${encodeURIComponent(examName)}/${encodeURIComponent(branch)}/${encodeURIComponent(date)}`);
            if (!response.ok) throw new Error('Failed to fetch examiner types');
            
            const types = await response.json();
            types.forEach(type => {
                const option = new Option(type, type);
                examinerTypeFilter.appendChild(option);
            });

            examinerTypeFilter.disabled = false;
            applyFiltersBtn.disabled = false;
        } catch (error) {
            showError('Error loading examiner types: ' + error.message);
        }
    }

    // Apply filters and fetch data
    async function applyFilters() {
        try {
            showLoading();
            exportExcelBtn.disabled = true; // Disable export button while loading

            const filters = {
                examName: examNameFilter.value,
                branch: branchFilter.value,
                examDate: examDateFilter.value,
                examinerType: examinerTypeFilter.value
            };

            const queryString = new URLSearchParams(filters).toString();
            const response = await fetch(`/api/daily-sheet?${queryString}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch data');
            }
            
            const data = await response.json();
            currentData = data;

            if (data.length === 0) {
                showNoData();
                exportExcelBtn.disabled = true; // Keep export button disabled if no data
            } else {
                populateTable(data);
                exportExcelBtn.disabled = false; // Enable export button only if data exists
            }

            hideLoading();
        } catch (error) {
            showError('Error fetching data: ' + error.message);
            exportExcelBtn.disabled = true;
        }
    }

    // Populate table with data
    function populateTable(data) {
        const tbody = dataTable.querySelector('tbody');
        tbody.innerHTML = '';

        data.forEach((item, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.branch}</td>
                <td>${item.semester}</td>
                <td>${item.examinerType}</td>
                <td>${formatDate(item.examDate)}</td>
                <td>${item.subjectCode}</td>
                <td>${item.examinerName}</td>
                <td>${formatCurrency(item.taAmount)}</td>
                <td>${formatCurrency(item.daAmount)}</td>
                <td>${formatCurrency(item.honorarium)}</td>
                <td>${formatCurrency(item.billAmount)}</td>
            `;
        });

        dataTable.style.display = 'table';
    }

    // Format date for Excel (mm-dd-yyyy)
    function formatExcelDate(dateString) {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${day}-${year}`;
    }

    // Export to Excel
    function exportToExcel() {
        if (currentData.length === 0) return;

        const workbook = XLSX.utils.book_new();
        const worksheetData = currentData.map((item, index) => ({
            'Sr. No.': index + 1,
            'Branch': item.branch,
            'Sem': item.semester,
            'Examiner Type': item.examinerType,
            'Date': formatExcelDate(item.examDate),
            'Subject Code': item.subjectCode,
            'Person Name': item.examinerName,
            'Amount of TA': item.taAmount,
            'Amount of DA': item.daAmount,
            'Amount of Honorarium': item.honorarium,
            'Total Amount': item.billAmount,
            'Original Bill/RC Book with True Copy Attached': '',
            'Remark': ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);

        // Set column widths
        const colWidths = [
            { wch: 8 },  // Sr. No.
            { wch: 10 }, // Branch
            { wch: 6 },  // Sem
            { wch: 15 }, // Examiner Type
            { wch: 12 }, // Date
            { wch: 12 }, // Subject Code
            { wch: 25 }, // Person Name
            { wch: 12 }, // TA
            { wch: 12 }, // DA
            { wch: 12 }, // Honorarium
            { wch: 12 }, // Total
            { wch: 20 }, // Original Bill
            { wch: 15 }  // Remark
        ];
        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Viva Daily Sheet');

        // Generate filename with current date
        const today = new Date().toISOString().split('T')[0];
        const fileName = `viva_daily_sheet_${today}.xlsx`;

        XLSX.writeFile(workbook, fileName);
    }

    // Helper functions
    function showLoading() {
        loadingMessage.style.display = 'block';
        dataTable.style.display = 'none';
        errorMessage.style.display = 'none';
        noDataMessage.style.display = 'none';
    }

    function hideLoading() {
        loadingMessage.style.display = 'none';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        dataTable.style.display = 'none';
        hideLoading();
    }

    function showNoData() {
        noDataMessage.style.display = 'block';
        dataTable.style.display = 'none';
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Event listeners
    examNameFilter.addEventListener('change', () => {
        loadBranches(examNameFilter.value);
        examDateFilter.innerHTML = '<option value="">Select Date</option>';
        examinerTypeFilter.innerHTML = '<option value="">Select Type</option>';
        exportExcelBtn.disabled = true; // Disable export button when filter changes
    });

    branchFilter.addEventListener('change', () => {
        loadDates(examNameFilter.value, branchFilter.value);
        examinerTypeFilter.innerHTML = '<option value="">Select Type</option>';
        exportExcelBtn.disabled = true; // Disable export button when filter changes
    });

    examDateFilter.addEventListener('change', () => {
        loadExaminerTypes(examNameFilter.value, branchFilter.value, examDateFilter.value);
        exportExcelBtn.disabled = true; // Disable export button when filter changes
    });

    examinerTypeFilter.addEventListener('change', () => {
        applyFiltersBtn.disabled = !examinerTypeFilter.value;
        exportExcelBtn.disabled = true; // Disable export button when filter changes
    });

    applyFiltersBtn.addEventListener('click', applyFilters);
    exportExcelBtn.addEventListener('click', exportToExcel);

    // Initialize the page
    initializeExamNames();
});
