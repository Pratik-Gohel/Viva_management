document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = config.getApiBaseUrl();

    // Filter elements
    const examNameFilter = document.getElementById('examNameFilter');
    const branchFilter = document.getElementById('branchFilter');
    const examDateFilter = document.getElementById('examDateFilter');
    const examinerTypeFilter = document.getElementById('examinerTypeFilter');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const exportExcelBtn = document.getElementById('exportExcel');

    // Table elements
    const dataTable = document.getElementById('dataTable');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const noDataMessage = document.getElementById('noDataMessage');

    let currentData = [];

    // Define examiner type order for sorting
    const examinerTypeOrder = {
        'External': 1,
        'Internal': 2,
        'Lab Assistant': 3,
        'Peon': 4
    };

    // Function to sort examination details
    function sortExaminationDetails(details) {
        return details.sort((a, b) => {
            // First sort by date in ascending order
            const dateA = new Date(a.examDate);
            const dateB = new Date(b.examDate);
            
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            
            // If dates are equal, sort by examiner type order
            const typeOrderA = examinerTypeOrder[a.examinerType] || 999;
            const typeOrderB = examinerTypeOrder[b.examinerType] || 999;
            
            return typeOrderA - typeOrderB;
        });
    }

    // Initialize exam names
    async function initializeExamNames() {
        try {
            showLoading();
            const response = await fetch(`${API_BASE_URL}/api/exam-names`);
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

            const response = await fetch(`${API_BASE_URL}/api/branches/${encodeURIComponent(examName)}`);
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

            const response = await fetch(`${API_BASE_URL}/api/dates/${encodeURIComponent(examName)}/${encodeURIComponent(branch)}`);
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

            const response = await fetch(`${API_BASE_URL}/api/examiner-types/${encodeURIComponent(examName)}/${encodeURIComponent(branch)}/${encodeURIComponent(date)}`);
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
            const response = await fetch(`${API_BASE_URL}/api/daily-sheet?${queryString}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch data');
            }
            
            let data = await response.json();
            data = sortExaminationDetails(data);
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
        const tbody = document.querySelector('#dataTable tbody');
        tbody.innerHTML = '';
        
        data.forEach((item, index) => {
            const row = document.createElement('tr');
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
                <td>${item.documentAttached || 'NO'}</td>
            `;
            tbody.appendChild(row);
        });

        hideLoading();
        document.getElementById('dataTable').style.display = 'table';
    }

    // Function to format date as mm-dd-yyyy
    function formatExcelDate(dateString) {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${day}-${year}`;
    }

    // Export to Excel
    async function exportToExcel() {
        try {
            // Get the current exam name from the dropdown
            const examNameSelect = document.getElementById('examNameFilter');
            const selectedExamName = examNameSelect.value;

            if (!selectedExamName) {
                showToast('Please select an exam name', 'error');
                return;
            }

            // Use the sorted current data
            const data = sortExaminationDetails([...currentData]);

            if (data.length === 0) {
                showToast('No data to export', 'error');
                return;
            }

            // Create worksheet with formatted data and specific column sequence
            const worksheetData = data.map((item, index) => ({
                'Sr. No.': index + 1,
                'Branch': item.branch,
                'Sem': item.semester,
                'Examiner Type': item.examinerType,
                'Exam Date': formatExcelDate(item.examDate),
                'Subject Code': item.subjectCode,
                'Name Of Person': item.examinerName,
                'Amounts Of TA': item.taAmount,
                'Amounts Of DA': item.daAmount,
                'Amounts Of Honorarium': item.honorarium,
                'Total Amounts': item.billAmount,
                'Original Bill/RC Book with True Copy Attached': item.documentAttached || 'NO',
                'Remark': ''  // Empty remark column as requested
            }));

            const worksheet = XLSX.utils.json_to_sheet(worksheetData);

            // Set column widths
            const colWidths = [
                { wch: 8 },  // Sr. No.
                { wch: 10 }, // Branch
                { wch: 6 },  // Sem
                { wch: 15 }, // Examiner Type
                { wch: 12 }, // Exam Date
                { wch: 12 }, // Subject Code
                { wch: 25 }, // Name Of Person
                { wch: 15 }, // Amounts Of TA
                { wch: 15 }, // Amounts Of DA
                { wch: 20 }, // Amounts Of Honorarium
                { wch: 15 }, // Total Amounts
                { wch: 35 }, // Original Bill
                { wch: 15 }  // Remark
            ];
            worksheet['!cols'] = colWidths;

            // Add some styling to the header row
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            const headerStyle = {
                font: { bold: true },
                alignment: { horizontal: 'center' },
                fill: {
                    fgColor: { rgb: "EEEEEE" }
                }
            };

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!worksheet[address]) continue;
                worksheet[address].s = headerStyle;
            }

            // Create workbook and append worksheet
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Sheet');

            // Generate Excel file with exam name and date
            const currentDate = new Date().toLocaleDateString().replace(/\//g, '-');
            const fileName = `${selectedExamName}_daily-sheet_${currentDate}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            showToast('Excel file exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showToast('Error exporting to Excel', 'error');
        }
    }

    // Helper functions
    function showLoading() {
        loadingSpinner.style.display = 'block';
        dataTable.style.display = 'none';
        errorMessage.style.display = 'none';
        noDataMessage.style.display = 'none';
    }

    function hideLoading() {
        loadingSpinner.style.display = 'none';
    }

    function showError(message) {
        const errorSpan = errorMessage.querySelector('span');
        if (errorSpan) {
            errorSpan.textContent = message;
        }
        errorMessage.style.display = 'block';
        dataTable.style.display = 'none';
        hideLoading();
    }

    function showNoData() {
        noDataMessage.style.display = 'block';
        dataTable.style.display = 'none';
        hideLoading();
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
