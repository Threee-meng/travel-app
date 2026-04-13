import { useState, useEffect } from 'react'
import Map from './components/Map'
import CreateTripModal from './components/CreateTripModal'
import TripEdit from './components/TripEdit'
import AuthModal from './components/AuthModal'
import NotesModal from './components/NotesModal'
import UserProfile from './components/UserProfile'
import ShareModal from './components/ShareModal'
import { useAuth } from './context/useAuth'
import './App.css'

const TABS = [
  { id: 'world', name: '世界图鉴' },
  { id: 'trip', name: '我的行程' },
  { id: 'notes', name: '旅行札记' }
]

function WorldGuide() {
  return <Map />
}

function MyTrip({ trips, onCreateTrip, onDeleteTrip, onUpdateTrip, onOpenAuth, isLoggedIn, onShareTrip }) {
  const [showModal, setShowModal] = useState(false)
  const [editingTrip, setEditingTrip] = useState(null)

  const handleCreateTrip = (tripData) => {
    onCreateTrip(tripData)
    setShowModal(false)
  }

  const handleEditTrip = (trip) => {
    setEditingTrip(trip)
  }

  const handleUpdateTrip = (updatedTrip) => {
    onUpdateTrip(updatedTrip)
    setEditingTrip(null)
  }

  // 生成行程天数名称
  const generateTripName = (startDate, endDate) => {
    if (!startDate || !endDate) return '行程'
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    return `${days}日游`
  }

  if (!isLoggedIn) {
    return (
      <div className="trip-page">
        <div className="trip-left">
          <Map />
        </div>
        <div className="trip-right trip-auth-panel">
          <p className="trip-auth-tip">登录后可创建行程，数据保存在本机并与当前邮箱账号绑定。</p>
          <button type="button" className="create-trip-btn" onClick={onOpenAuth}>
            <span className="create-trip-icon">🔐</span>
            <span className="create-trip-text">登录 / 注册</span>
          </button>
        </div>
      </div>
    )
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
                  <div className="trip-card-cities">{trip.cities.join('、')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {showModal && (
        <CreateTripModal
          onClose={() => setShowModal(false)}
          onConfirm={handleCreateTrip}
        />
      )}
      {editingTrip && (
        <TripEdit
          trip={editingTrip}
          onSave={handleUpdateTrip}
          onClose={() => setEditingTrip(null)}
        />
      )}
    </div>
  )
}

function TravelNotes({ notes, onAddNote, onUpdateNote, onDeleteNote, onOpenAuth, isLoggedIn }) {
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  const handleAddNote = (noteData) => {
    onAddNote(noteData)
    setShowModal(false)
  }

  const handleEditNote = (note) => {
    setEditingNote(note)
  }

  const handleUpdateNote = (updatedNote) => {
    onUpdateNote(updatedNote)
    setEditingNote(null)
  }

  if (!isLoggedIn) {
    return (
      <div className="notes-page">
        <div className="notes-auth-panel">
          <p className="notes-auth-tip">登录后可创建旅行札记，记录你的旅行故事。</p>
          <button type="button" className="create-note-btn" onClick={onOpenAuth}>
            <span className="create-note-icon">🔐</span>
            <span className="create-note-text">登录 / 注册</span>
          </button>
        </div>
      </div>
    )
  }

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
                onClick={() => handleEditNote(note)}
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
          onSave={handleAddNote}
        />
      )}
      {editingNote && (
        <NotesModal
          open={!!editingNote}
          onClose={() => setEditingNote(null)}
          note={editingNote}
          onSave={handleUpdateNote}
        />
      )}
    </div>
  )
}

function loadTripsForEmail(userEmail) {
  if (!userEmail) return []
  try {
    const saved = localStorage.getItem(`travel-trips-${userEmail}`)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function loadNotesForEmail(userEmail) {
  if (!userEmail) return []
  try {
    const saved = localStorage.getItem(`travel-notes-${userEmail}`)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function TripTabRoute({ userEmail, isLoggedIn, onOpenAuth, onShareTrip }) {
  const [trips, setTrips] = useState(() => loadTripsForEmail(userEmail))

  useEffect(() => {
    if (!userEmail) return
    localStorage.setItem(`travel-trips-${userEmail}`, JSON.stringify(trips))
  }, [trips, userEmail])

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
    setTrips((prev) => [...prev, newTrip])
  }

  const handleUpdateTrip = (updatedTrip) => {
    setTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)))
  }

  const handleDeleteTrip = (index) => {
    setTrips((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <MyTrip
      trips={trips}
      onCreateTrip={handleCreateTrip}
      onDeleteTrip={handleDeleteTrip}
      onUpdateTrip={handleUpdateTrip}
      isLoggedIn={isLoggedIn}
      onOpenAuth={onOpenAuth}
      onShareTrip={onShareTrip}
    />
  )
}

function NotesTabRoute({ userEmail, isLoggedIn, onOpenAuth }) {
  const [notes, setNotes] = useState(() => loadNotesForEmail(userEmail))

  useEffect(() => {
    if (!userEmail) return
    localStorage.setItem(`travel-notes-${userEmail}`, JSON.stringify(notes))
  }, [notes, userEmail])

  const handleAddNote = (noteData) => {
    setNotes((prev) => [...prev, noteData])
  }

  const handleUpdateNote = (updatedNote) => {
    setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)))
  }

  const handleDeleteNote = (noteId) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  return (
    <TravelNotes
      notes={notes}
      onAddNote={handleAddNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      isLoggedIn={isLoggedIn}
      onOpenAuth={onOpenAuth}
    />
  )
}

function App() {
  const { email, isLoggedIn, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('world')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState('login')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sharingTrip, setSharingTrip] = useState(null)

  const handleShareTrip = (trip) => {
    setSharingTrip(trip)
    setShareModalOpen(true)
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
        <div className="app-header-auth">
          {isLoggedIn ? (
            <>
              <button
                type="button"
                className="app-profile-btn"
                onClick={() => setProfileModalOpen(true)}
                title="个人资料"
              >
                👤
              </button>
              <span className="app-user-email" title={email}>{email}</span>
              <button
                type="button"
                className="app-auth-btn secondary"
                onClick={logout}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="app-auth-btn secondary"
                onClick={() => {
                  setAuthModalMode('login')
                  setAuthModalOpen(true)
                }}
              >
                登录
              </button>
              <button
                type="button"
                className="app-auth-btn"
                onClick={() => {
                  setAuthModalMode('register')
                  setAuthModalOpen(true)
                }}
              >
                注册
              </button>
            </>
          )}
        </div>
      </header>
      <main className="app-main">
        {activeTab === 'world' && <WorldGuide />}
        {activeTab === 'trip' && (
          <TripTabRoute
            key={email ?? 'guest'}
            userEmail={email}
            isLoggedIn={isLoggedIn}
            onOpenAuth={() => {
              setAuthModalMode('login')
              setAuthModalOpen(true)
            }}
            onShareTrip={handleShareTrip}
          />
        )}
        {activeTab === 'notes' && (
          <NotesTabRoute
            key={email ?? 'guest'}
            userEmail={email}
            isLoggedIn={isLoggedIn}
            onOpenAuth={() => {
              setAuthModalMode('login')
              setAuthModalOpen(true)
            }}
          />
        )}
      </main>
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
      <UserProfile
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        trip={sharingTrip}
      />
    </div>
  )
}

export default App