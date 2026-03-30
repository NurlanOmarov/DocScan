import React from 'react'

interface SpinnerProps {
  size?: number
  color?: string
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 40,
  color = '#10b981',
  className = '',
}) => {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    border: `${Math.max(2, size / 12)}px solid rgba(255,255,255,0.15)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }

  return (
    <div
      className={className}
      style={style}
      role="status"
      aria-label="Загрузка..."
    />
  )
}
