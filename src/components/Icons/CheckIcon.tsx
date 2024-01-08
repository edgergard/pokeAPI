import React from 'react';

type Props = {
  size: number;
};

const CheckIcon: React.FC<Props> = ({ size }) => {
  return (
  <svg
    xmlns="http://www.w3.org/2000/svg" 
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2.5}
    stroke="currentColor"
    className={`w-${size} h-${size}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
  );
};

export default CheckIcon;