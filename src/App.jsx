import { useState, useEffect } from 'react'
import Map from './components/Map'
import CreateTripModal from './components/CreateTripModal'
import TripEdit from './components/TripEdit'
import NotesModal from './components/NotesModal'
import ShareModal from './components/ShareModal'
import './App.css'

const TABS = [
  { id: 'world', name: '世界图鉴' },
  { id: 'trip', name: '我的行程' },
  { id: 'notes', name: '旅行札记' }
]

function WorldGuide() {
  return <Map />
}

function MyTrip({ trips, onCreateTrip, onDeleteTrip, onUpdateTrip, onShareTrip }) {
  const [showModal, setShowModal] = useState(false)
  const [editingTrip, setEditingTrip] = useState(null)

  const generateTripName = (startDate, endDate) => {
    if (!startDate || !endDate) return '行程'
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    return `${days}日游`
  }

  return (
    <div className="trip-page">
      <div className="trip-left">
        <Map />
      </div>
      <div className="trip-right">
        <button className="create-trip-btn" onClick={() => setShowModal(true)}>
          <span className="create-trip-icon">+</span>
          <span className="create-trip-text">创建行程</span>
        </button>
        <div className="trip-section">
          <h3>我的行程</h3>
          <div className="trip-section-list">
            {trips.length === 0 ? (
              <div className="trip-section-empty">暂无行程</div>
            ) : (
              trips.map((trip, index) => (
                <div
                  key={trip.id || index}
                  className="trip-card"
                  onClick={() => handleEditTrip(trip)}
                >
                  <div className="trip-card-header">
                    <span className="trip-card-title">{generateTripName(trip.startDate, trip.endDate)}</span>
                    <div className="trip-card-actions">
                      <button
                        className="trip-card-share"
                        onClick={(e) => {
                          e.stopPropagation()
                          onShareTrip(trip)
                        }}
                        title="分享行程"
                      >
                        📤
                      </button>
                      <button
                        className="trip-card-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteTrip(index)
                        }}
                        title="删除行程"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="trip-card-dates">{trip.startDate} ~ {trip.endDate}</div>
                  <div className="trip-card-cities">{trip.cities?.join('、')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {showModal && (
        <CreateTripModal
          onClose={() => setShowModal(false)}
          onConfirm={(tripData) => {
            onCreateTrip(tripData)
            setShowModal(false)
          }}
        />
      )}
      {editingTrip && (
        <TripEdit
          trip={editingTrip}
          onSave={(updatedTrip) => {
            onUpdateTrip(updatedTrip)
            setEditingTrip(null)
          }}
          onClose={() => setEditingTrip(null)}
        />
      )}
    </div>
  )
}

function TravelNotes({ notes, onAddNote, onUpdateNote, onDeleteNote }) {
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  return (
    <div className="notes-page">
      <div className="notes-header">
        <h2>旅行札记</h2>
        <button className="create-note-btn" onClick={() => setShowModal(true)}>
          <span className="create-note-icon">+</span>
          <span className="create-note-text">创建笔记</span>
        </button>
      </div>
      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="notes-empty">暂无笔记</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="note-card">
              <div className="note-card-header">
                <h3 className="note-card-title">{note.title}</h3>
                <button
                  className="note-card-delete"
                  onClick={() => onDeleteNote(note.id)}
                >
                  ×
                </button>
              </div>
              <div className="note-card-meta">
                <span className="note-card-location">{note.location}</span>
                <span className="note-card-date">{note.date}</span>
              </div>
              <div className="note-card-content">
                {note.content.length > 100 ? `${note.content.substring(0, 100)}...` : note.content}
              </div>
              <button
                className="note-card-edit"
                onClick={() => setEditingNote(note)}
              >
                编辑
              </button>
            </div>
          ))
        )}
      </div>
      {showModal && (
        <NotesModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={(noteData) => {
            onAddNote(noteData)
            setShowModal(false)
          }}
        />
      )}
      {editingNote && (
        <NotesModal
          open={!!editingNote}
          onClose={() => setEditingNote(null)}
          note={editingNote}
          onSave={(updatedNote) => {
            onUpdateNote(updatedNote)
            setEditingNote(null)
          }}
        />
      )}
    </div>
  )
}

function loadTrips() {
  try {
    const saved = localStorage.getItem('travel-trips')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function loadNotes() {
  try {
    const saved = localStorage.getItem('travel-notes')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function SharedTripView({ shareCode }) {
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shareCode) return

    fetch(`/api/share/${shareCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setTrip(data.trip)
        } else {
          setError(data.error || '加载失败')
        }
      })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false))
  }, [shareCode])

  if (loading) return <div className="shared-trip-loading">加载分享行程中...</div>
  if (error) return <div className="shared-trip-error">{error}</div>
  if (!trip) return null

  return (
    <div className="shared-trip-view">
      <h2>查看分享的行程</h2>
      <div className="shared-trip-info">
        <p><strong>目的地：</strong>{trip.cities?.join('、')}</p>
        <p><strong>时间：</strong>{trip.startDate} ~ {trip.endDate}</p>
      </div>
      <Map sharedTrip={trip} />
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('world')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sharingTrip, setSharingTrip] = useState(null)
  const [shareCodeFromUrl, setShareCodeFromUrl] = useState(null)

  // 从URL读取分享码
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('share')
    if (code) {
      setShareCodeFromUrl(code)
      setActiveTab('trip')
    }
  }, [])

  // 行程
  const [trips, setTrips] = useState(() => loadTrips())
  useEffect(() => {
    localStorage.setItem('travel-trips', JSON.stringify(trips))
  }, [trips])

  const handleCreateTrip = (tripData) => {
    const newTrip = {
      id: Date.now().toString(),
      name: '',
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      cities: tripData.cities,
      favorites: [],
      days: []
    }
    setTrips(prev => [...prev, newTrip])
  }

  const handleUpdateTrip = (updatedTrip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t))
  }

  const handleDeleteTrip = (index) => {
    setTrips(prev => prev.filter((_, i) => i !== index))
  }

  const handleShareTrip = (trip) => {
    setSharingTrip(trip)
    setShareModalOpen(true)
  }

  // 札记
  const [notes, setNotes] = useState(() => loadNotes())
  useEffect(() => {
    localStorage.setItem('travel-notes', JSON.stringify(notes))
  }, [notes])

  const handleAddNote = (noteData) => {
    const newNote = {
      id: Date.now().toString(),
      ...noteData
    }
    setNotes(prev => [...prev, newNote])
  }

  const handleUpdateNote = (updatedNote) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n))
  }

  const handleDeleteNote = (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  // 有分享码时只显示分享的行程
  if (shareCodeFromUrl) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="app-brand">🌶️ 旅行辣椒</div>
          <div className="app-header-auth">
            <button
              type="button"
              className="app-auth-btn secondary"
              onClick={() => {
                setShareCodeFromUrl(null)
                window.history.pushState({}, '', window.location.pathname)
              }}
            >
              返回我的行程
            </button>
          </div>
        </header>
        <main className="app-main">
          <SharedTripView shareCode={shareCodeFromUrl} />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          🌶️ 旅行辣椒
        </div>
        <div className="app-header-tabs-wrap">
          <nav className="tab-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="app-main">
        {activeTab === 'world' && <WorldGuide />}
        {activeTab === 'trip' && (
          <MyTrip
            trips={trips}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onUpdateTrip={handleUpdateTrip}
            onShareTrip={handleShareTrip}
          />
        )}
        {activeTab === 'notes' && (
          <TravelNotes
            notes={notes}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />
        )}
      </main>
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        trip={sharingTrip}
      />
    </div>
  )
}

export default App
