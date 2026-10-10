import { useState, useId } from 'react';

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

const StarRating = ({ value = 0, onChange, readOnly = false, size = 16 }) => {
    const [hoverValue, setHoverValue] = useState(0);

    const handleClick = (starValue) => {
        if (!onChange || readOnly) return;
        onChange(hoverValue || starValue);
    };

    const handleMouseMove = (starValue, e) => {
        if (readOnly) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const half = x < rect.width / 2;
        setHoverValue(half ? starValue - 0.5 : starValue);
    };

    const handleMouseLeave = () => {
        if (readOnly) return;
        setHoverValue(0);
    };

    const displayValue = hoverValue || value;

    const uniqueId = useId();

    const stars = [];
    for (let i = 1; i <= 5; i++) {
        const filled = displayValue >= i;
        const halfFilled = !filled && displayValue >= i - 0.5;

        stars.push(
            <span
                key={i}
                className={`relative inline-flex items-center justify-center ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                style={{ width: size, height: size }}
                onClick={() => handleClick(i)}
                onMouseMove={(e) => handleMouseMove(i, e)}
            >
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    className={filled ? 'text-amber-400' : 'text-slate-200'}
                >
                    {halfFilled && (
                        <defs>
                            <clipPath id={`half-${uniqueId}-${i}`}>
                                <rect x="0" y="0" width="12" height="24" />
                            </clipPath>
                        </defs>
                    )}
                    <path
                        d={STAR_PATH}
                        fill={filled ? '#fbbf24' : halfFilled ? '#e2e8f0' : '#e2e8f0'}
                        stroke="none"
                    />
                    {halfFilled && (
                        <path
                            d={STAR_PATH}
                            fill="#fbbf24"
                            stroke="none"
                            clipPath={`url(#half-${uniqueId}-${i})`}
                        />
                    )}
                </svg>
            </span>
        );
    }

    return (
        <div className="inline-flex items-center gap-0.5" onMouseLeave={handleMouseLeave}>
            {stars}
        </div>
    );
};

export default StarRating;
