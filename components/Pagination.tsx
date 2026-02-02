import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalCount, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    if (totalPages <= 1) {
        return null;
    }
    
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow + 2) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        pages.push(1);
        if (currentPage > 3) {
            pages.push('...');
        }
        
        let startPage = Math.max(2, currentPage - 1);
        let endPage = Math.min(totalPages - 1, currentPage + 1);

        if (currentPage <= 2) {
            endPage = 3;
        }
        if (currentPage >= totalPages - 1) {
            startPage = totalPages - 2;
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 2) {
            pages.push('...');
        }
        pages.push(totalPages);
    }
    
    return (
        <div className="flex items-center justify-between py-3 px-6 border-t dark:border-gray-700">
             <span className="text-sm text-gray-700 dark:text-gray-400">
                Page {currentPage} of {totalPages} ({totalCount} items)
            </span>
            <div className="flex items-center space-x-1">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 text-sm rounded-md disabled:opacity-50 bg-gray-200 dark:bg-gray-600">Prev</button>
                {pages.map((pageNum, index) => (
                    typeof pageNum === 'number' ? (
                         <button key={index} onClick={() => handlePageChange(pageNum)} className={`px-3 py-1 text-sm rounded-md ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>{pageNum}</button>
                    ) : (
                        <span key={index} className="px-3 py-1 text-sm">...</span>
                    )
                ))}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm rounded-md disabled:opacity-50 bg-gray-200 dark:bg-gray-600">Next</button>
            </div>
        </div>
    );
};

export default Pagination;
