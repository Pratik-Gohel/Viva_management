document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const examNameSelect = document.getElementById('examName');
    const branchSelect = document.getElementById('branch');
    const examDateSelect = document.getElementById('examDate');
    const examinerTypeSelect = document.getElementById('examinerType');
    const applyFilterBtn = document.getElementById('applyFilter');
    const exportExcelBtn = document.getElementById('exportExcel');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const noDataMessage = document.getElementById('noDataMessage');
    const dataTable = document.getElementById('dataTable');

    let filteredData = [];

    // Initialize exam names
    async function loadExamNames() {
        try {
            const response = await fetch('/api/examination-details/exam-names');
            const data = await response.json();
            
            examNameSelect.innerHTML = '<option value="">Select Exam Name</option>';
            data.forEach(examName => {
                const option = document.createElement('option');
                option.value = examName;
                option.textContent = examName;
                examNameSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading exam names:', error);
            showToast('Error loading exam names', 'error');
        }
    }

    // Load branches based on exam name
    async function loadBranches(examName) {
        try {
            const response = await fetch(`/api/examination-details/branches?examName=${encodeURIComponent(examName)}`);
            const data = await response.json();
            
            branchSelect.innerHTML = '<option value="">Select Branch</option><option value="all">All Branches</option>';
            data.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch;
                option.textContent = branch;
                branchSelect.appendChild(option);
            });
            branchSelect.disabled = false;
        } catch (error) {
            console.error('Error loading branches:', error);
            showToast('Error loading branches', 'error');
        }
    }

    // Load dates based on exam name and branch
    async function loadDates(examName, branch) {
        try {
            const url = `/api/examination-details/dates?examName=${encodeURIComponent(examName)}${branch !== 'all' ? `&branch=${encodeURIComponent(branch)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            examDateSelect.innerHTML = '<option value="">Select Date</option><option value="all">All Dates</option>';
            data.sort((a, b) => new Date(a) - new Date(b)).forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = formatDate(date);
                examDateSelect.appendChild(option);
            });
            examDateSelect.disabled = false;
        } catch (error) {
            console.error('Error loading dates:', error);
            showToast('Error loading dates', 'error');
        }
    }

    // Load examiner types based on exam name, branch, and date
    async function loadExaminerTypes(examName, branch, date) {
        try {
            const url = `/api/examination-details/examiner-types?examName=${encodeURIComponent(examName)}${branch !== 'all' ? `&branch=${encodeURIComponent(branch)}` : ''}${date !== 'all' ? `&date=${encodeURIComponent(date)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            examinerTypeSelect.innerHTML = '<option value="">Select Examiner Type</option><option value="all">All Types</option>';
            data.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                examinerTypeSelect.appendChild(option);
            });
            examinerTypeSelect.disabled = false;
        } catch (error) {
            console.error('Error loading examiner types:', error);
            showToast('Error loading examiner types', 'error');
        }
    }

    // Format date to mm-dd-yyyy
    function formatDate(dateString) {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${day}-${year}`;
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

    // Apply filters and fetch data
    async function applyFilters() {
        const examName = examNameSelect.value;
        const branch = branchSelect.value;
        const date = examDateSelect.value;
        const examinerType = examinerTypeSelect.value;

        if (!examName) {
            showToast('Please select an exam name', 'warning');
            return;
        }

        loadingSpinner.style.display = 'block';
        noDataMessage.style.display = 'none';
        dataTable.innerHTML = '';
        exportExcelBtn.disabled = true;

        try {
            const url = `/api/examination-details/filter?examName=${encodeURIComponent(examName)}${branch !== 'all' ? `&branch=${encodeURIComponent(branch)}` : ''}${date !== 'all' ? `&date=${encodeURIComponent(date)}` : ''}${examinerType !== 'all' ? `&examinerType=${encodeURIComponent(examinerType)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!data || data.length === 0) {
                noDataMessage.style.display = 'block';
                loadingSpinner.style.display = 'none';
                return;
            }

            // Process and display data
            filteredData = processData(data);
            displayData(filteredData);
            exportExcelBtn.disabled = false;
        } catch (error) {
            console.error('Error applying filters:', error);
            showToast('Error fetching data', 'error');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Process data for display and export
    function processData(data) {
        // Sort by date
        data.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

        // Separate external examiners
        const externalExaminers = data.filter(item => item.examinerType === 'External');
        const internalStaff = data.filter(item => ['Internal', 'Lab Assistant', 'Peon'].includes(item.examinerType));

        // Group internal staff by name and sum their amounts
        const internalGroups = internalStaff.reduce((groups, item) => {
            const key = `${item.examinerName}-${item.bankDetails?.accountNo || ''}`; // Group by name and account number
            if (!groups[key]) {
                groups[key] = {
                    examinerName: item.examinerName,
                    bankDetails: item.bankDetails,
                    totalAmount: 0,
                    examDates: new Set(),
                    examinerType: item.examinerType
                };
            }
            groups[key].totalAmount += item.billAmount;
            groups[key].examDates.add(item.examDate);
            return groups;
        }, {});

        // Convert grouped data to array format
        const processedData = [
            ...externalExaminers.map(item => ({
                amount: item.billAmount,
                ifscCode: item.bankDetails?.ifscCode || '',
                accountNo: item.bankDetails?.accountNo || '',
                fixedCol1: '10',
                examinerName: item.examinerName,
                fixedCol2: 'Bhavnagar',
                fixedCol3: 'NEFT',
                fixedCol4: 'GEC',
                examDate: item.examDate,
                examinerType: 'External'
            })),
            ...Object.values(internalGroups).map(group => ({
                amount: group.totalAmount,
                ifscCode: group.bankDetails?.ifscCode || '',
                accountNo: group.bankDetails?.accountNo || '',
                fixedCol1: '10',
                examinerName: group.examinerName,
                fixedCol2: 'Bhavnagar',
                fixedCol3: 'NEFT',
                fixedCol4: 'GEC',
                examDate: Array.from(group.examDates).sort().join(', '),
                examinerType: group.examinerType
            }))
        ];

        return processedData.sort((a, b) => {
            // Sort by examiner type first (External first)
            if (a.examinerType === 'External' && b.examinerType !== 'External') return -1;
            if (a.examinerType !== 'External' && b.examinerType === 'External') return 1;
            
            // Then sort by date
            const aDate = a.examDate.split(', ')[0];
            const bDate = b.examDate.split(', ')[0];
            return new Date(aDate) - new Date(bDate);
        });
    }

    // Display data in table
    function displayData(data) {
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>IFSC Code</th>
                    <th>Account No</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr class="${item.examinerType.toLowerCase()}-row">
                        <td>${formatDate(item.examDate.split(', ')[0])}${item.examDate.includes(',') ? ' +' : ''}</td>
                        <td>${item.examinerName}</td>
                        <td>${item.examinerType}</td>
                        <td>₹${item.amount.toFixed(2)}</td>
                        <td>${item.ifscCode}</td>
                        <td>${item.accountNo}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>Total Amount</strong></td>
                    <td colspan="3"><strong>₹${data.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</strong></td>
                </tr>
            </tfoot>
        `;
        dataTable.innerHTML = '';
        dataTable.appendChild(table);
    }

    // Export to Excel
    function exportToExcel() {
        const excelData = filteredData.map(item => ({
            'Amount': item.amount,
            'IFSC Number': item.ifscCode,
            'Account Number': item.accountNo,
            'Fixed Column 1': '10',
            'Name of the examiner': item.examinerName,
            'Fixed Column 2': 'Bhavnagar',
            'Fixed Column 3': 'NEFT',
            'Fixed Column 4': 'GEC'
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Viva Payment Details');

        // Auto-size columns
        const colWidths = [
            { wch: 12 }, // Amount
            { wch: 15 }, // IFSC
            { wch: 20 }, // Account
            { wch: 8 },  // Fixed 1
            { wch: 30 }, // Name
            { wch: 12 }, // Fixed 2
            { wch: 8 },  // Fixed 3
            { wch: 8 }   // Fixed 4
        ];
        ws['!cols'] = colWidths;
        
        // Generate filename with current date
        const currentDate = formatDate(new Date());
        const fileName = `Viva_Payment_Details_${currentDate}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
    }

    // Event Listeners
    examNameSelect.addEventListener('change', () => {
        const examName = examNameSelect.value;
        if (examName) {
            loadBranches(examName);
            branchSelect.value = '';
            examDateSelect.value = '';
            examinerTypeSelect.value = '';
            examDateSelect.disabled = true;
            examinerTypeSelect.disabled = true;
        }
    });

    branchSelect.addEventListener('change', () => {
        const examName = examNameSelect.value;
        const branch = branchSelect.value;
        if (examName && branch) {
            loadDates(examName, branch);
            examDateSelect.value = '';
            examinerTypeSelect.value = '';
            examinerTypeSelect.disabled = true;
        }
    });

    examDateSelect.addEventListener('change', () => {
        const examName = examNameSelect.value;
        const branch = branchSelect.value;
        const date = examDateSelect.value;
        if (examName && branch && date) {
            loadExaminerTypes(examName, branch, date);
        }
    });

    applyFilterBtn.addEventListener('click', applyFilters);
    exportExcelBtn.addEventListener('click', exportToExcel);

    // Initialize
    loadExamNames();
});
