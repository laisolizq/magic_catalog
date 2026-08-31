import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoNegre from '../../assets/logo_negre.png'
import './LifeCounterPage.css'

const INITIAL_LIFE = 20
const DEBOUNCE_MS = 100

export function LifeCounterPage() {
  const navigate = useNavigate()
  const [player1Life, setPlayer1Life] = useState(INITIAL_LIFE)
  const [player2Life, setPlayer2Life] = useState(INITIAL_LIFE)
  
  const lastClickTime = useRef(0)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved1 = localStorage.getItem('life-counter-player1')
      const saved2 = localStorage.getItem('life-counter-player2')
      if (saved1) setPlayer1Life(parseInt(saved1, 10))
      if (saved2) setPlayer2Life(parseInt(saved2, 10))
    } catch {
      // localStorage might not be available
    }
  }, [])

  // Save to localStorage whenever values change
  useEffect(() => {
    try {
      localStorage.setItem('life-counter-player1', String(player1Life))
      localStorage.setItem('life-counter-player2', String(player2Life))
    } catch {
      // localStorage might not be available
    }
  }, [player1Life, player2Life])

  const debounce = (callback: () => void) => {
    const now = Date.now()
    if (now - lastClickTime.current >= DEBOUNCE_MS) {
      lastClickTime.current = now
      callback()
    }
  }

  const incrementPlayer1 = () => debounce(() => setPlayer1Life((current) => current + 1))
  const decrementPlayer1 = () => debounce(() => setPlayer1Life((current) => current - 1))

  const incrementPlayer2 = () => debounce(() => setPlayer2Life((current) => current + 1))
  const decrementPlayer2 = () => debounce(() => setPlayer2Life((current) => current - 1))

  const resetBoth = () => {
    lastClickTime.current = Date.now()
    setPlayer1Life(INITIAL_LIFE)
    setPlayer2Life(INITIAL_LIFE)
  }

  return (
    <div className="life-counter-page">
      {/* Player 1 (Top, rotated 180 degrees) */}
      <div className="life-counter-section player-1">
        <div className="life-counter-container">
          <button
            className="life-counter-btn minus-btn"
            onClick={decrementPlayer1}
            aria-label="Decrease player 1 life"
          >
            −
          </button>

          <div className="life-counter-display">
            <span className="life-value">{player1Life}</span>
          </div>

          <button
            className="life-counter-btn plus-btn"
            onClick={incrementPlayer1}
            aria-label="Increase player 1 life"
          >
            +
          </button>
        </div>
      </div>

      {/* Divider with controls */}
      <div className="life-counter-divider">
        <button
          className="life-counter-divider-btn back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          title="Go back"
        >
          ←
        </button>
        
        <img src={logoNegre} alt="Magic Catalog Logo" className="divider-logo" />
        
        <button
          className="life-counter-divider-btn reset-btn"
          onClick={resetBoth}
          aria-label="Reset both players life to 20"
          title="Reset to 20"
        >
          ↻
        </button>
      </div>

      {/* Player 2 (Bottom, normal) */}
      <div className="life-counter-section player-2">
        <div className="life-counter-container">
          <button
            className="life-counter-btn minus-btn"
            onClick={decrementPlayer2}
            aria-label="Decrease player 2 life"
          >
            −
          </button>

          <div className="life-counter-display">
            <span className="life-value">{player2Life}</span>
          </div>

          <button
            className="life-counter-btn plus-btn"
            onClick={incrementPlayer2}
            aria-label="Increase player 2 life"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
