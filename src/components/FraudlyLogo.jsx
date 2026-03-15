import CircularText from './art/CircularText'

export default function FraudlyLogo({ onMouseEnter, onMouseLeave }) {
  return (
    <div
      className="relative w-10 h-10 flex items-center justify-center"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CircularText 
        text="FRAUDLY" 
        onHover="speedUp" 
        spinDuration={20} 
        size="xs"
      />
    </div>
  )
}
