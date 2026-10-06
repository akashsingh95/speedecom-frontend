import React from 'react';

/**
 * ViewTransition - Wraps views with book page-flip transition
 * Creates a smooth page-turning effect when navigating between views
 */
const ViewTransition = ({ children, className = '' }) => {
    return (
        <div className={`page-transition ${className}`}>
            {children}
        </div>
    );
};

export default ViewTransition;
