import React from 'react';

interface LoadingSkeletonProps {
  count?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ count = 10 }) => {
  return (
    <div className="crypto-list">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton skeleton-row"></div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
