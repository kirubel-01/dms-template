import React from 'react';

interface PasswordStrengthProps {
  password?: string;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password = '' }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length > 7) score++;
    if (password.length > 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const score = getStrength();
  const strengthLevels = [
    { text: 'Very Weak', color: 'bg-red-500', width: 'w-1/5' },
    { text: 'Weak', color: 'bg-red-500', width: 'w-2/5' },
    { text: 'Medium', color: 'bg-yellow-500', width: 'w-3/5' },
    { text: 'Strong', color: 'bg-green-500', width: 'w-4/5' },
    { text: 'Very Strong', color: 'bg-green-500', width: 'w-full' },
  ];

  const currentLevel = strengthLevels[score > 0 ? score -1 : 0];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${currentLevel.color} ${currentLevel.width}`}
        ></div>
      </div>
      <p className="text-xs text-right mt-1 text-gray-500 dark:text-gray-400">
        Strength: {currentLevel.text}
      </p>
    </div>
  );
};

export default PasswordStrength;