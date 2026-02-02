import React from 'react';

interface SkeletonLoaderProps {
  rows?: number;
  columns: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ rows = 5, columns }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="bg-white dark:bg-gray-800 animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default SkeletonLoader;
