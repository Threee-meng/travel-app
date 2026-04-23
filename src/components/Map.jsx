import { useCallback, useEffect, useRef, useState } from 'react'
import './Map.css'

const AMap_KEY = 'e2c347ab0fa80da1220c9650bd4492e6'
const VISITED_PLACES_STORAGE_KEY = 'travel-visited-places'

function readStoredVisitedPlaces() {
  try {
    const saved = localStorage.getItem(VISITED_PLACES_STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed.filter((place) => Array.isArray(place.position)) : []
  } catch {
    return []
  }
}

function normalizeText(value, fallback = '') {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' ')
  }

  return String(value || fallback).trim()
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizePosition(position) {
  if (!Array.isArray(position) || position.length < 2) return null

  const lng = Number(position[0])
  const lat = Number(position[1])

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null

  return [lng, lat]
}

function getPositionKey(position) {
  const normalized = normalizePosition(position)
  return normalized ? `${normalized[0].toFixed(5)},${normalized[1].toFixed(5)}` : ''
}

function createVisitedPlace({ name, address, position, source = 'manual' }) {
  const normalizedPosition = normalizePosition(position)

  if (!normalizedPosition) {
    return null
  }

  return {
    id: `visited-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: normalizeText(name, '未命名地点') || '未命名地点',
    address: normalizeText(address, ''),
    position: normalizedPosition,
    source,
    createdAt: new Date().toISOString(),
  }
}

function Map({ mode = 'explore' }) {
  const isWorldGuide = mode === 'world'
  const [pois, setPois] = useState([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [userMarkers, setUserMarkers] = useState([])
  const [visitedPlaces, setVisitedPlaces] = useState(() => (
    isWorldGuide ? readStoredVisitedPlaces() : []
  ))
  const [showRoute, setShowRoute] = useState(false)
  const [draggingVisitedPlaceId, setDraggingVisitedPlaceId] = useState(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const userMarkerObjectsRef = useRef([])
  const visitedMarkerObjectsRef = useRef([])
  const routeRef = useRef(null)
  const visitedPlacesRef = useRef(visitedPlaces)
  const statusTimerRef = useRef(null)
  const errorTimerRef = useRef(null)

  const showTemporaryStatus = useCallback((message) => {
    setStatusMessage(message)

    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current)
    }

    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage('')
      statusTimerRef.current = null
    }, 2400)
  }, [])

  const showTemporaryError = useCallback((message, duration = 3000) => {
    setError(message)

    if (errorTimerRef.current) {
      window.clearTimeout(errorTimerRef.current)
    }

    errorTimerRef.current = window.setTimeout(() => {
      setError('')
      errorTimerRef.current = null
    }, duration)
  }, [])

  const clearMarkers = useCallback(() => {
    if (mapInstance.current && markersRef.current.length > 0) {
      mapInstance.current.remove(markersRef.current)
      markersRef.current = []
    }
  }, [])

  const clearVisitedMarkerObjects = useCallback(() => {
    if (mapInstance.current && visitedMarkerObjectsRef.current.length > 0) {
      mapInstance.current.remove(visitedMarkerObjectsRef.current)
    }

    visitedMarkerObjectsRef.current = []
  }, [])

  const clearRoute = useCallback(() => {
    if (mapInstance.current && routeRef.current) {
      mapInstance.current.remove(routeRef.current)
      routeRef.current = null
    }

    setShowRoute(false)
  }, [])

  const removeVisitedPlace = useCallback((placeId) => {
    setVisitedPlaces((prev) => prev.filter((place) => place.id !== placeId))
    clearRoute()
  }, [clearRoute])

  const moveVisitedPlace = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return

    const currentPlaces = visitedPlacesRef.current
    const fromIndex = currentPlaces.findIndex((place) => place.id === fromId)
    const toIndex = currentPlaces.findIndex((place) => place.id === toId)

    if (fromIndex === -1 || toIndex === -1) return

    const nextPlaces = [...currentPlaces]
    const [movedPlace] = nextPlaces.splice(fromIndex, 1)
    nextPlaces.splice(toIndex, 0, movedPlace)

    visitedPlacesRef.current = nextPlaces
    setVisitedPlaces(nextPlaces)
    clearRoute()
  }, [clearRoute])

  const renderVisitedMarkers = useCallback((places) => {
    if (!isWorldGuide || !mapInstance.current || !window.AMap) return

    clearVisitedMarkerObjects()

    const nextMarkers = places
      .map((place) => {
        const position = normalizePosition(place.position)
        if (!position) return null

        const marker = new window.AMap.Marker({
          position,
          title: place.name,
          content: `<div class="visited-star-marker" title="${escapeHtml(place.name)}">⭐</div>`,
          offset: new window.AMap.Pixel(-16, -32),
        })

        const infoWindow = new window.AMap.InfoWindow({
          content: `
            <div class="visited-info-window">
              <div class="visited-info-title">⭐ ${escapeHtml(place.name)}</div>
              <div class="visited-info-address">${escapeHtml(place.address || '已标记为去过的地点')}</div>
            </div>
          `,
          offset: new window.AMap.Pixel(0, -32),
        })

        marker.on('click', () => {
          infoWindow.open(mapInstance.current, marker.getPosition())
        })

        mapInstance.current.add(marker)
        return marker
      })
      .filter(Boolean)

    visitedMarkerObjectsRef.current = nextMarkers
  }, [clearVisitedMarkerObjects, isWorldGuide])

  useEffect(() => {
    if (!isWorldGuide) return

    visitedPlacesRef.current = visitedPlaces
    localStorage.setItem(VISITED_PLACES_STORAGE_KEY, JSON.stringify(visitedPlaces))
    renderVisitedMarkers(visitedPlaces)
  }, [isWorldGuide, renderVisitedMarkers, visitedPlaces])

  const addVisitedPlace = useCallback((placeData) => {
    const place = createVisitedPlace(placeData)

    if (!place) {
      showTemporaryError('无法标记这个地点，请换一个位置再试')
      return
    }

    const placeKey = getPositionKey(place.position)
    const alreadyExists = visitedPlacesRef.current.some(
      (visitedPlace) => getPositionKey(visitedPlace.position) === placeKey,
    )

    if (alreadyExists) {
      showTemporaryStatus('这个地点已经在世界图鉴里了')
      return
    }

    const nextPlaces = [...visitedPlacesRef.current, place]
    visitedPlacesRef.current = nextPlaces
    setVisitedPlaces(nextPlaces)
    showTemporaryStatus(`已标记去过：${place.name}`)
  }, [showTemporaryError, showTemporaryStatus])

  const addUserMarker = useCallback((position, name) => {
    if (!mapInstance.current || !window.AMap) return

    const marker = new window.AMap.Marker({
      position,
      title: name,
      icon: new window.AMap.Icon({
        size: new window.AMap.Size(30, 30),
        image: 'https://a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
        imageSize: new window.AMap.Size(30, 30),
      }),
    })

    const infoWindow = new window.AMap.InfoWindow({
      content: `
        <div style="padding:8px;min-width:200px">
          <h3 style="margin:0 0 8px;font-size:14px">${escapeHtml(name)}</h3>
          <p style="margin:0;color:#666;font-size:12px">点击清除按钮删除此标记</p>
        </div>
      `,
      offset: new window.AMap.Pixel(0, -30),
    })

    marker.on('click', () => {
      infoWindow.open(mapInstance.current, marker.getPosition())
    })

    mapInstance.current.add(marker)
    userMarkerObjectsRef.current.push(marker)

    const newMarker = {
      id: Date.now().toString(),
      name,
      position,
    }

    setUserMarkers((prev) => [...prev, newMarker])
  }, [])

  const clearUserMarkers = useCallback(() => {
    if (mapInstance.current && userMarkerObjectsRef.current.length > 0) {
      mapInstance.current.remove(userMarkerObjectsRef.current)
    }

    userMarkerObjectsRef.current = []
    setUserMarkers([])
    clearRoute()
  }, [clearRoute])

  const clearVisitedPlaces = useCallback(() => {
    visitedPlacesRef.current = []
    setVisitedPlaces([])
    clearVisitedMarkerObjects()
    clearRoute()
    showTemporaryStatus('已清空世界图鉴标记')
  }, [clearRoute, clearVisitedMarkerObjects, showTemporaryStatus])

  const generateRoute = useCallback(() => {
    const routeItems = isWorldGuide ? visitedPlacesRef.current : userMarkers

    if (!mapInstance.current || routeItems.length < 2) {
      showTemporaryError(isWorldGuide ? '请至少标记2个去过地点以生成路线' : '请至少添加2个标记点以生成路线')
      return
    }

    clearRoute()

    const path = routeItems
      .map((marker) => normalizePosition(marker.position))
      .filter(Boolean)

    if (path.length < 2) {
      showTemporaryError('有效地点不足，无法生成路线')
      return
    }

    const polyline = new window.AMap.Polyline({
      path,
      strokeColor: '#ff6b35',
      strokeWeight: 4,
      strokeOpacity: 0.8,
      lineJoin: 'round',
    })

    mapInstance.current.add(polyline)
    routeRef.current = polyline
    setShowRoute(true)
    mapInstance.current.setFitView()
  }, [clearRoute, isWorldGuide, showTemporaryError, userMarkers])

  const addMarkers = useCallback((poiList) => {
    if (!mapInstance.current || !window.AMap) return
    clearMarkers()

    poiList.forEach((poi) => {
      if (!poi.location) return

      const marker = new window.AMap.Marker({
        position: [poi.location.lng, poi.location.lat],
        title: poi.name,
      })

      const infoWindow = new window.AMap.InfoWindow({
        content: `
          <div style="padding:8px;min-width:200px">
            <h3 style="margin:0 0 8px;font-size:14px">${escapeHtml(poi.name)}</h3>
            <p style="margin:0;color:#666;font-size:12px">${escapeHtml(poi.address || '暂无地址')}</p>
          </div>
        `,
        offset: new window.AMap.Pixel(0, -30),
      })

      marker.on('click', () => {
        infoWindow.open(mapInstance.current, marker.getPosition())
      })

      mapInstance.current.add(marker)
      markersRef.current.push(marker)
    })
  }, [clearMarkers])

  const searchPOI = useCallback(async (nextKeyword) => {
    const trimmedKeyword = nextKeyword.trim()

    if (!trimmedKeyword) return
    if (!mapInstance.current) {
      showTemporaryError('地图加载中，请稍候...', 2000)
      return
    }

    setLoading(true)
    setError('')
    clearMarkers()

    try {
      const response = await fetch(
        `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(trimmedKeyword)}&city=全国&offset=20&page=1&key=${AMap_KEY}`,
      )
      const data = await response.json()

      if (data.status === '1' && data.pois && data.pois.length > 0) {
        const formattedPois = data.pois
          .map((poi) => {
            const location = normalizeText(poi.location)
            const [lng, lat] = location.split(',').map(Number)

            return {
              name: normalizeText(poi.name, trimmedKeyword),
              address: normalizeText(poi.address || poi.district, '暂无地址'),
              location: Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null,
              type: normalizeText(poi.type),
            }
          })
          .filter((poi) => poi.location)

        setPois(formattedPois)
        addMarkers(formattedPois)

        if (formattedPois.length > 0) {
          mapInstance.current.setFitView()
        }
      } else {
        setPois([])
        showTemporaryError(data.info || '未找到结果')
      }
    } catch (err) {
      console.error('搜索失败:', err)
      showTemporaryError('搜索请求失败', 2000)
    } finally {
      setLoading(false)
    }
  }, [addMarkers, clearMarkers, showTemporaryError])

  const handleMapClick = useCallback((event) => {
    const lng = event.lnglat.getLng()
    const lat = event.lnglat.getLat()
    const position = [lng, lat]

    fetch(`https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${AMap_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        const address = data.status === '1' && data.regeocode
          ? normalizeText(data.regeocode.formatted_address)
          : ''
        const name = address || `地点 ${lng.toFixed(4)}, ${lat.toFixed(4)}`

        if (isWorldGuide) {
          addVisitedPlace({ name, address, position, source: 'map-click' })
        } else {
          addUserMarker(position, name)
        }
      })
      .catch(() => {
        const fallbackName = `地点 ${lng.toFixed(4)}, ${lat.toFixed(4)}`

        if (isWorldGuide) {
          addVisitedPlace({ name: fallbackName, position, source: 'map-click' })
        } else {
          addUserMarker(position, fallbackName)
        }
      })
  }, [addUserMarker, addVisitedPlace, isWorldGuide])

  const handlePoiSelect = (poi) => {
    if (!mapInstance.current || !poi.location) return

    mapInstance.current.setZoom(15)
    mapInstance.current.setCenter([poi.location.lng, poi.location.lat])
  }

  const handleMarkPoiVisited = (event, poi) => {
    event.stopPropagation()
    addVisitedPlace({
      name: poi.name,
      address: poi.address,
      position: [poi.location.lng, poi.location.lat],
      source: 'search',
    })
  }

  const clearPois = () => {
    setPois([])
    clearMarkers()
  }

  useEffect(() => {
    const initMap = () => {
      const container = document.getElementById('amap-container')
      if (!container || !window.AMap) return

      const map = new window.AMap.Map('amap-container', {
        zoom: 5,
        center: [104.1954, 35.8617],
        mapStyle: 'amap://styles/normal',
      })

      mapInstance.current = map
      map.on('click', handleMapClick)

      if (isWorldGuide) {
        renderVisitedMarkers(visitedPlacesRef.current)
      } else {
        const marker = new window.AMap.Marker({
          position: [104.1954, 35.8617],
          title: '中国',
        })
        map.add(marker)
      }
    }

    if (window.AMap) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${AMap_KEY}`
      script.async = true
      script.onload = initMap
      script.onerror = () => showTemporaryError('地图加载失败')
      document.head.appendChild(script)
    }

    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current)
      }

      if (errorTimerRef.current) {
        window.clearTimeout(errorTimerRef.current)
      }

      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
      }

      markersRef.current = []
      userMarkerObjectsRef.current = []
      visitedMarkerObjectsRef.current = []
      routeRef.current = null
    }
  }, [handleMapClick, isWorldGuide, renderVisitedMarkers, showTemporaryError])

  const activeMarkers = isWorldGuide ? visitedPlaces : userMarkers
  const hasRouteTargets = activeMarkers.length > 0
  const routeButtonDisabled = activeMarkers.length < 2

  return (
    <div className={`map-page ${isWorldGuide ? 'world-guide-map' : ''}`}>
      <header className="map-header">
        {isWorldGuide ? (
          <div className="world-guide-search-block">
            <div className="search-bar">
              <input
                type="text"
                placeholder="搜索城市、景点、国家或地区..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && searchPOI(keyword)}
              />
              <button onClick={() => searchPOI(keyword)} disabled={loading}>
                {loading ? '搜索中...' : '搜索'}
              </button>
            </div>
            <p className="world-guide-hint">点击地图/搜索地点标记你去过的地方，生成你的足迹🗺️👣</p>
          </div>
        ) : (
          <div className="search-bar">
            <input
              type="text"
              placeholder="搜索景点、酒店、美食、商店..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && searchPOI(keyword)}
            />
            <button onClick={() => searchPOI(keyword)} disabled={loading}>
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        )}
        {error && <div className="search-error">{error}</div>}
        {statusMessage && <div className="map-status">{statusMessage}</div>}

        <div className="map-tools">
          {hasRouteTargets && (
            <>
              <button className="tool-btn" onClick={generateRoute} disabled={routeButtonDisabled}>
                🗺️ 生成路线
              </button>
              <button className="tool-btn" onClick={isWorldGuide ? clearVisitedPlaces : clearUserMarkers}>
                🗑️ {isWorldGuide ? '清空图鉴' : '清除标记'}
              </button>
              {isWorldGuide && (
                <div className="world-guide-count" title="已标记去过地点数量">
                  <strong>{visitedPlaces.length}</strong>
                  <span>已标记</span>
                </div>
              )}
            </>
          )}
          {showRoute && (
            <button className="tool-btn" onClick={clearRoute}>
              🚫 清除路线
            </button>
          )}
        </div>
      </header>

      <main className="map-container">
        <div id="amap-container" className="amap-wrapper"></div>
      </main>

      {pois.length > 0 && (
        <aside className="poi-list">
          <div className="poi-list-header">
            <h3>搜索结果 ({pois.length})</h3>
            <button type="button" className="poi-list-close" onClick={clearPois}>×</button>
          </div>
          <ul>
            {pois.map((poi, index) => (
              <li key={`${poi.name}-${index}`} onClick={() => handlePoiSelect(poi)}>
                <div className="poi-result-main">
                  <strong>{poi.name}</strong>
                  <span>{poi.address || '暂无地址'}</span>
                </div>
                {isWorldGuide && (
                  <button className="poi-mark-btn" onClick={(event) => handleMarkPoiVisited(event, poi)}>
                    标记去过
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {isWorldGuide && visitedPlaces.length > 0 && (
        <aside className="user-markers-list visited-places-list">
          <h3>去过的地点 ({visitedPlaces.length})</h3>
          <ul>
            {visitedPlaces.map((place) => (
              <li
                key={place.id}
                className={`visited-place-item ${draggingVisitedPlaceId === place.id ? 'dragging' : ''}`}
                draggable
                onDragStart={() => setDraggingVisitedPlaceId(place.id)}
                onDragEnd={() => setDraggingVisitedPlaceId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  moveVisitedPlace(draggingVisitedPlaceId, place.id)
                  setDraggingVisitedPlaceId(null)
                }}
                onClick={() => {
                  if (mapInstance.current) {
                    mapInstance.current.setZoom(15)
                    mapInstance.current.setCenter(place.position)
                  }
                }}
              >
                <div className="visited-place-main">
                  <strong>⭐ {place.name}</strong>
                  <span>{place.address || `${place.position[0].toFixed(4)}, ${place.position[1].toFixed(4)}`}</span>
                </div>
                <button
                  className="visited-remove-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeVisitedPlace(place.id)
                  }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {!isWorldGuide && userMarkers.length > 0 && (
        <aside className="user-markers-list">
          <h3>我的标记 ({userMarkers.length})</h3>
          <ul>
            {userMarkers.map((marker) => (
              <li key={marker.id} onClick={() => {
                if (mapInstance.current) {
                  mapInstance.current.setZoom(15)
                  mapInstance.current.setCenter(marker.position)
                }
              }}>
                <strong>{marker.name}</strong>
                <span>{marker.position[0].toFixed(4)}, {marker.position[1].toFixed(4)}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}

export default Map
