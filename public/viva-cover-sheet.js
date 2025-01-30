document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = config.getApiBaseUrl();

    let currentResults = [];

    // Initialize form elements
    const examNameSelect = document.getElementById('examName');
    const branchSelect = document.getElementById('branch');
    const dateSelect = document.getElementById('examDate');
    const examinerTypeSelect = document.getElementById('examinerType');
    const applyFilterBtn = document.getElementById('applyFilter');
    const exportExcelBtn = document.getElementById('exportExcel');
    const resultsSection = document.getElementById('resultSection');
    const dataTable = document.getElementById('dataTable');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const noDataMessage = document.getElementById('noDataMessage');

    // Load exam names on page load
    loadExamNames();

    // Event listeners for cascading dropdowns
    examNameSelect.addEventListener('change', handleExamNameChange);
    branchSelect.addEventListener('change', handleBranchChange);
    dateSelect.addEventListener('change', handleDateChange);
    examinerTypeSelect.addEventListener('change', handleExaminerTypeChange);
    applyFilterBtn.addEventListener('click', handleSearch);
    exportExcelBtn.addEventListener('click', downloadExcel);

    async function loadExamNames() {
        try {
            showLoading();
            const response = await fetch('/api/exam-names');
            const examNames = await response.json();
            
            examNameSelect.innerHTML = '<option value="">Select Exam Name</option>';
            examNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                examNameSelect.appendChild(option);
            });

            hideLoading();
        } catch (error) {
            hideLoading();
            console.error('Error loading exam names:', error);
            showError('Failed to load exam names. Please try again.');
        }
    }

    async function handleExamNameChange() {
        branchSelect.disabled = true;
        dateSelect.disabled = true;
        examinerTypeSelect.disabled = true;
        exportExcelBtn.disabled = true;
        
        if (!examNameSelect.value) return;

        try {
            showLoading();
            const response = await fetch(`/api/branches?examName=${encodeURIComponent(examNameSelect.value)}`);
            const branches = await response.json();
            
            branchSelect.innerHTML = '<option value="">Select Branch</option><option value="ALL">All Branches</option>';
            branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch;
                option.textContent = branch;
                branchSelect.appendChild(option);
            });
            
            branchSelect.disabled = false;
            hideLoading();
        } catch (error) {
            hideLoading();
            console.error('Error loading branches:', error);
            showError('Failed to load branches. Please try again.');
        }
    }

    async function handleBranchChange() {
        dateSelect.disabled = true;
        examinerTypeSelect.disabled = true;
        exportExcelBtn.disabled = true;
        
        if (!branchSelect.value) return;

        try {
            showLoading();
            const response = await fetch(`/api/dates?examName=${encodeURIComponent(examNameSelect.value)}&branch=${encodeURIComponent(branchSelect.value)}`);
            const dates = await response.json();
            
            dateSelect.innerHTML = '<option value="">Select Date</option><option value="ALL">All Dates</option>';
            dates.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = new Date(date).toLocaleDateString();
                dateSelect.appendChild(option);
            });
            
            dateSelect.disabled = false;
            hideLoading();
        } catch (error) {
            hideLoading();
            showError('Failed to load dates. Please try again.');
        }
    }

    function handleDateChange() {
        examinerTypeSelect.disabled = !dateSelect.value;
    }

    function handleExaminerTypeChange() {
        applyFilterBtn.disabled = !examinerTypeSelect.value;
    }

    async function handleSearch() {
        if (!validateForm()) return;

        try {
            loadingSpinner.style.display = 'block';
            errorMessage.style.display = 'none';
            noDataMessage.style.display = 'none';
            resultsSection.style.display = 'none';

            const queryParams = new URLSearchParams({
                examName: examNameSelect.value,
                branch: branchSelect.value,
                date: dateSelect.value,
                examinerType: examinerTypeSelect.value
            });

            showLoading();
            const response = await fetch(`/api/viva-cover-sheet?${queryParams}`);
            const data = await response.json();
            
            if (data.length === 0) {
                loadingSpinner.style.display = 'none';
                noDataMessage.style.display = 'block';
                return;
            }

            currentResults = data;
            displayResults(data);
            exportExcelBtn.disabled = false;
            resultsSection.style.display = 'block';
            loadingSpinner.style.display = 'none';
            hideLoading();
        } catch (error) {
            hideLoading();
            console.error('Error searching records:', error);
            loadingSpinner.style.display = 'none';
            errorMessage.style.display = 'block';
            errorMessage.textContent = 'Failed to search records. Please try again.';
        }
    }

    function validateForm() {
        if (!examNameSelect.value) {
            alert('Please select an exam name.');
            return false;
        }
        if (!branchSelect.value) {
            alert('Please select a branch.');
            return false;
        }
        if (!dateSelect.value) {
            alert('Please select a date.');
            return false;
        }
        if (!examinerTypeSelect.value) {
            alert('Please select an examiner type.');
            return false;
        }
        return true;
    }

    function displayResults(data) {
        const sortedData = data.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));
        
        const tableBody = dataTable.querySelector('tbody');
        tableBody.innerHTML = '';
        sortedData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${formatExcelDate(item.examDate)}</td>
                <td>${findbranchCode(item.branch)}</td>
                <td>${item.semester}</td>
                <td>${item.subjectCode}</td>
                <td>${item.examinerType}</td>
                <td>${item.examinerName}</td>
                <td>${item.numberOfStudents}</td>
            `;
            tableBody.appendChild(row);
        });
        dataTable.style.display = 'block';
    }
    function findbranchCode(branch) {
        const branchMap = {
            EC   : 11,   
            IT   : 16,
            CE   : 7,
            MECH : 19,
            CIVIL: 6,
            ICT  : 32
        };
        return branchMap[branch] || 0;
    }


    function downloadExcel() {
        if (currentResults.length === 0) return;

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(currentResults.map(item => ({
            'Semester': item.semester,
            'branchCode': findbranchCode(item.branch),
            'Subject Code': item.subjectCode,
            'Date': formatExcelDate(item.examDate),
            'Examiner Type': item.examinerType,
            'Examiner Name': item.examinerName,
            'No. of Students': item.numberOfStudents,
            'No. of Marksheet Cover': '1',
            'No. of Remuneration Bill': '1'
        })));

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Viva Cover Sheet');
        XLSX.writeFile(workbook, 'viva-cover-sheet.xlsx');
    }

    function formatExcelDate(dateString) {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

     function findbranchCode(branch) {
         const branchMap = {
             EC   : 11,   
             IT   : 16,
             CE   : 7,
             MECH : 19,
             CIVIL: 6,
             ICT  : 32
         };
         return branchMap[branch] || 0;
     }


    // // Initialize exam names
    // async function initializeExamNames() {
    //     try {
    //         showLoading();
    //         const response = await fetch(`${API_BASE_URL}/api/exam-names`);
    //         if (!response.ok) throw new Error('Failed to fetch exam names');
            
    //         const examNames = await response.json();
    //         examNames.forEach(name => {
    //             const option = new Option(name, name);
    //             examNameFilter.appendChild(option);
    //         });

    //         hideLoading();
    //     } catch (error) {
    //         showError('Error loading exam names: ' + error.message);
    //     }
    // }

    // // Load branches based on exam name
    // async function loadBranches(examName) {
    //     try {
    //         branchFilter.innerHTML = `
    //             <option value="">Select Branch</option>
    //             <option value="ALL">All Branches</option>
    //             <option value="EC">EC</option>
    //             <option value="IT">IT</option>
    //             <option value="CE">CE</option>
    //             <option value="MECH">MECH</option>
    //             <option value="CIVIL">CIVIL</option>
    //             <option value="ICT">ICT</option>
    //         `;
    //         branchFilter.disabled = !examName;
    //         examDateFilter.disabled = true;
    //         examinerTypeFilter.disabled = true;

    //         if (!examName) return;

    //         const response = await fetch(`${API_BASE_URL}/api/branches/${encodeURIComponent(examName)}`);
    //         if (!response.ok) throw new Error('Failed to fetch branches');
            
    //         const branches = await response.json();
    //         branches.forEach(branch => {
    //             const option = new Option(branch, branch);
    //             branchFilter.appendChild(option);
    //         });

    //         checkAndEnableButtons();
    //     } catch (error) {
    //         showError('Error loading branches: ' + error.message);
    //     }
    // }

    // // Load dates based on exam name and branch
    // async function loadDates(examName, branch) {
    //     try {
    //         examDateFilter.innerHTML = `
    //             <option value="">Select Date</option>
    //             <option value="ALL">All Dates</option>
    //         `;
    //         examDateFilter.disabled = !branch;
    //         examinerTypeFilter.disabled = true;

    //         if (!examName || !branch) return;

    //         const response = await fetch(`${API_BASE_URL}/api/dates/${encodeURIComponent(examName)}/${encodeURIComponent(branch)}`);
    //         if (!response.ok) throw new Error('Failed to fetch dates');
            
    //         const dates = await response.json();
    //         dates.forEach(date => {
    //             const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    //                 year: 'numeric',
    //                 month: 'short',
    //                 day: 'numeric'
    //             });
    //             const option = new Option(formattedDate, date);
    //             examDateFilter.appendChild(option);
    //         });

    //         checkAndEnableButtons();
    //     } catch (error) {
    //         showError('Error loading dates: ' + error.message);
    //     }
    // }

    // // Check and enable buttons
    // function checkAndEnableButtons() {
    //     const allFieldsSelected = 
    //         examNameFilter.value && 
    //         branchFilter.value && 
    //         examDateFilter.value;

    //         console.log(allFieldsSelected);
    //     if (allFieldsSelected) {
    //         examinerTypeFilter.disabled = false;
    //         examinerTypeFilter.value = 'External';  // Auto-select External
    //         applyFiltersBtn.disabled = false;
    //     }
    // }

    // // Apply filters and fetch data
    // async function applyFilters() {
    //     try {
    //         showLoading();

    //         const filters = {
    //             examName: examNameFilter.value,
    //             branch: branchFilter.value,
    //             examDate: examDateFilter.value,
    //             examinerType: 'External' // Always External for viva cover sheet
    //         };

    //         const queryString = new URLSearchParams(filters).toString();
    //         const response = await fetch(`${API_BASE_URL}/api/viva-cover-sheet?${queryString}`);
    //         console.log(response);
            
    //         if (!response.ok) {
    //             throw new Error(`Failed to fetch data: ${response.status}`);
    //         }
            
    //         const data = await response.json();
    //         currentData = data;

    //         if (!data || data.length === 0) {
    //             showNoData();
    //         } else {
    //             populateTable(data);
    //             exportExcelBtn.disabled = false;
    //         }

    //         hideLoading();
    //     } catch (error) {
    //         console.error('Error fetching data:', error);
    //         showError(`Error fetching data: ${error.message}`);
    //     }
    // }

    // // Populate table with data
    // function populateTable(data) {
    //     const tbody = dataTable.querySelector('tbody');
    //     tbody.innerHTML = '';
        
    //     data.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));
        
    //     data.forEach((item, index) => {
    //         const row = document.createElement('tr');
    //         row.innerHTML = `
    //             <td>${index + 2}</td>
    //             <td>${formatDate(item.examDate)}</td>
    //             <td>${findbranchCode(item.branch)}</td>
    //             <td>${item.semester}</td>
    //             <td>${item.subjectCode}</td>
    //             <td>${new Date(item.examDate).toLocaleDateString()}</td>
    //             <td>${item.examinerType}</td>
    //             <td>${item.examinerName}</td>
    //             <td>${item.numberOfStudents}</td>
    //         `;
    //         tbody.appendChild(row);
    //     });
    //     console.log(data);

    //     dataTable.style.display = 'table';
    //     noDataMessage.style.display = 'none';
    // }

    // function findbranchCode(branch) {
    //     const branchMap = {
    //         EC   : 11,   
    //         IT   : 16,
    //         CE   : 7,
    //         MECH : 19,
    //         CIVIL: 6,
    //         ICT  : 32
    //     };
    //     return branchMap[branch] || 0;
    // }

    // // Export to Excel
    // function exportToExcel() {
    //     if (!currentData.length) return;

    //     const workbook = XLSX.utils.book_new();
    //     const worksheet = XLSX.utils.json_to_sheet(currentData.map((item, index) => ({
    //         'Sr. No.': index + 1,
    //         'Date': formatDate(item.examDate),
    //         'branchCode': item.branchCode,
    //         'Semester': item.semester,
    //         'Subject Code': item.subjectCode,
    //         'date': new Date(item.examDate).toLocaleDateString(),
    //         'Examiner Type': item.examinerType,
    //         'Examiner Name': item.examinerName,
    //         'No. of Students': item.numberOfStudents
    //     })));

    //     XLSX.utils.book_append_sheet(workbook, worksheet, 'Viva Cover Sheet');
    //     XLSX.writeFile(workbook, 'viva_cover_sheet.xlsx');
    // }

    // Helper functions
    function showLoading() {
        loadingSpinner.style.display = 'flex';
        dataTable.style.display = 'none';
        errorMessage.style.display = 'none';
        noDataMessage.style.display = 'none';
    }

    function hideLoading() {
        loadingSpinner.style.display = 'none';
    }

    function showError(message) {
        errorMessage.querySelector('span').textContent = message;
        errorMessage.style.display = 'flex';
        loadingSpinner.style.display = 'none';
        dataTable.style.display = 'none';
        noDataMessage.style.display = 'none';
    }

    function showNoData() {
        noDataMessage.style.display = 'flex';
        dataTable.style.display = 'none';
        errorMessage.style.display = 'none';
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // // Event listeners
    // examNameFilter.addEventListener('change', () => {
    //     loadBranches(examNameFilter.value);
    // });

    // branchFilter.addEventListener('change', () => {
    //     if (branchFilter.value) {
    //         loadDates(examNameFilter.value, branchFilter.value);
    //     } else {
    //         examDateFilter.disabled = true;
    //         examinerTypeFilter.disabled = true;
    //         examinerTypeFilter.value = '';
    //     }
    // });

    // examDateFilter.addEventListener('change', () => {
    //     checkAndEnableButtons();
    // });

    // // Initialize event listeners
    // applyFiltersBtn.addEventListener('click', applyFilters);
    // exportExcelBtn.addEventListener('click', exportToExcel);

    // // Initialize the page
    // initializeExamNames();
});
