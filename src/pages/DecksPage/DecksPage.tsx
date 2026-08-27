import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { createDeck, deleteDeck, listDecks } from '../../services/deckService'
import type { Deck } from '../../types/deck'
import './DecksPage.css'

function CreateDeckModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (deck: Deck) => void
}) {
  const [name, setName] = useState('')
  const [decklist, setDecklist] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !decklist.trim()) {
      setError('Enter a deck name and paste a decklist.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const deck = await createDeck(name, decklist)
      onCreated(deck)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create deck.')
      setIsSaving(false)
    }
  }

  return (
    <div className="deck-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="deck-modal" role="dialog" aria-modal="true" aria-labelledby="new-deck-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="deck-modal-header">
          <h2 id="new-deck-title">New deck</h2>
          <button type="button" className="deck-icon-button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <label className="deck-field">
            <span>Deck name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </label>
          <label className="deck-field">
            <span>Decklist</span>
            <textarea value={decklist} onChange={(event) => setDecklist(event.target.value)} rows={12} placeholder={'4 Lightning Bolt\n2 Mountain'} />
          </label>
          {error && <p className="deck-error" role="alert">{error}</p>}
          <footer className="deck-modal-actions">
            <button type="button" className="deck-secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="deck-primary-button" disabled={isSaving}>{isSaving ? 'Creating...' : 'Create deck'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function DecksPage() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<Deck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const refresh = () => {
    setIsLoading(true)
    void listDecks().then(setDecks).catch(() => setError('Unable to load decks.')).finally(() => setIsLoading(false))
  }

  useEffect(() => {
    void listDecks().then(setDecks).catch(() => setError('Unable to load decks.')).finally(() => setIsLoading(false))
  }, [])

  const handleDelete = async (deck: Deck) => {
    if (!window.confirm(`Delete “${deck.name}”?`)) return
    await deleteDeck(deck.id)
    refresh()
  }

  return (
    <section className="decks-page">
      <header className="decks-page-header">
        <div>
          <Link className="decks-back" to="/catalog">← Catalog</Link>
          <h1>Decks</h1>
          <p>Keep your lists close to the cards you play.</p>
        </div>
        <button type="button" className="deck-primary-button" onClick={() => setIsCreateOpen(true)}>+ New deck</button>
      </header>

      {error && <p className="deck-error" role="alert">{error}</p>}
      {isLoading ? <p role="status">Loading decks...</p> : decks.length === 0 ? (
        <div className="decks-empty"><h2>No decks yet</h2><p>Create one by pasting a decklist.</p></div>
      ) : (
        <div className="deck-list" aria-label="Saved decks">
          {decks.map((deck) => (
            <article className="deck-list-item" key={deck.id}>
              <button type="button" className="deck-list-link" onClick={() => navigate(`/decks/${deck.id}`)}>
                <strong>{deck.name}</strong>
                <span>{deck.cards.length} unique cards{deck.unresolvedLines.length ? ` · ${deck.unresolvedLines.length} unresolved` : ''}</span>
              </button>
              <button type="button" className="deck-delete-button" onClick={() => void handleDelete(deck)} aria-label={`Delete ${deck.name}`} title="Delete deck">×</button>
            </article>
          ))}
        </div>
      )}

      {isCreateOpen && <CreateDeckModal onClose={() => setIsCreateOpen(false)} onCreated={(deck) => navigate(`/decks/${deck.id}`)} />}
    </section>
  )
}