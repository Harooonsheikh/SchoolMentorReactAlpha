import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TutorialButton from '../../components/TutorialButton'
import ContentSourceBar from '../../components/ContentSourceBar'
import { loadSource, saveSource } from '../../config/contentSource'
import { CHAIN_API_BASE } from '../../config/env'
import { getToken } from '../../auth/tokenStorage'
import { currentNetworkId } from '../../api/networkSchoolsApi'
import {
  AUDIENCES,
  AUD_LABEL,
  AUD_ICON,
} from './data'
import './Notifications.css'

const AUDIENCE_MAP = {
  all: 'All',
  principals: 'Principal',
  teachers: 'Teacher',
  parents: 'Parent',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [audienceFilter, setAudienceFilter] =
    useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [toast, setToast] = useState(null)
  const [source, setSource] = useState('custom')
  const [loading, setLoading] = useState(false)

  const networkId = currentNetworkId()
  const readOnly = source === 'mentor'

  const showToast = (
    message,
    type = 'success',
  ) => {
    setToast({ message, type })
  }

  useEffect(() => {
    setSource(
      loadSource('notifications') || 'custom',
    )
    loadNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return undefined

    const timer = setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => clearTimeout(timer)
  }, [toast])

  async function apiRequest(path, options = {}) {
    const token = getToken()

    const response = await fetch(
      `${CHAIN_API_BASE}${path}`,
      {
        ...options,
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
          ...(options.headers || {}),
        },
      },
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.message ||
          data?.detail ||
          data?.title ||
          `Request failed with status ${response.status}`,
      )
    }

    return data
  }

  async function loadNotifications() {
    if (!networkId) {
      showToast(
        'Network ID not found. Please log in again.',
        'warn',
      )
      return
    }

    try {
      setLoading(true)

      const response = await apiRequest(
        `/api/AHM_Notification/list?networkId=${encodeURIComponent(
          networkId,
        )}`,
      )

      const rows = Array.isArray(response?.data)
        ? response.data
        : []

      setNotifications(
        rows.map((item) => ({
          ...item,
          id:
            item.id ||
            item.notificationID ||
            item.notificationId,
          audience: normalizeAudience(
            item.audienceType ||
              item.audience ||
              'all',
          ),
        })),
      )
    } catch (error) {
      console.error(
        'Notifications list error:',
        error,
      )

      showToast(
        error?.message ||
          'Unable to load notifications.',
        'warn',
      )
    } finally {
      setLoading(false)
    }
  }

  async function sendNotification(form) {
    if (!networkId) {
      showToast(
        'Network ID not found. Please log in again.',
        'warn',
      )
      return false
    }

    try {
      const response = await apiRequest(
        '/api/AHM_Notification/send',
        {
          method: 'POST',
          body: JSON.stringify({
            networkID: Number(networkId),
            audienceType:
              AUDIENCE_MAP[form.audience] || 'All',
            title: form.title.trim(),
            message: form.message.trim(),
            notificationType: 'General',
          }),
        },
      )

      if (!response?.success) {
        showToast(
          response?.message ||
            'Notification could not be sent.',
          'warn',
        )
        return false
      }

      showToast(
        response?.message ||
          'Notification sent successfully.',
      )

      await loadNotifications()
      return true
    } catch (error) {
      console.error(
        'Send notification error:',
        error,
      )

      showToast(
        error?.message ||
          'Unable to send notification.',
        'warn',
      )

      return false
    }
  }

  async function getEstimatedRecipients(
    selectedAudience,
  ) {
    if (!networkId) return 0

    try {
      const response = await apiRequest(
        `/api/AHM_Notification/estimate?networkId=${encodeURIComponent(
          networkId,
        )}&audienceType=${encodeURIComponent(
          AUDIENCE_MAP[selectedAudience] || 'All',
        )}`,
      )

      return Number(
        response?.data?.estimatedCount || 0,
      )
    } catch (error) {
      console.error(
        'Recipient estimate error:',
        error,
      )

      return 0
    }
  }

  function changeSource(value) {
    setSource(value)
    saveSource('notifications', value)

    showToast(
      value === 'mentor'
        ? "Showing School Mentor's notifications."
        : 'Showing your notifications.',
      'info',
    )
  }

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()

    return notifications.filter((item) => {
      const text =
        `${item.title || ''} ${
          item.message || ''
        }`.toLowerCase()

      return (
        (audienceFilter === 'all' ||
          item.audience === audienceFilter) &&
        (!query || text.includes(query))
      )
    })
  }, [
    notifications,
    audienceFilter,
    search,
  ])

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div
            className="page-icon"
            style={{
              background:
                'linear-gradient(135deg,#1E3A8A,#1E40AF)',
            }}
          >
            <i className="fa-solid fa-bell" />
          </div>

          <div>
            <div className="page-title">
              Notifications
            </div>

            <div className="page-sub">
              Create and send announcements to your
              chain schools.
            </div>
          </div>
        </div>

        <TutorialButton />

        <button
          type="button"
          className="btn-primary"
          disabled={readOnly}
          onClick={() => setModal(true)}
        >
          <i className="fa-solid fa-plus" />
          {' '}
          New Notification
        </button>
      </div>

      <ContentSourceBar
        kind="notifications"
        label="Notifications"
        value={source}
        onChange={changeSource}
      />

      <div
        className="stat-grid"
        style={{
          gridTemplateColumns:
            'repeat(auto-fit,minmax(150px,1fr))',
        }}
      >
        <Stat
          icon="fa-bell"
          value={notifications.length}
          label="Total Notifications"
        />

        <Stat
          icon="fa-users"
          value={AUDIENCES.length}
          label="Audiences"
          className="s-warn"
        />
      </div>

      <div className="nt-cat-row">
        <button
          type="button"
          className={`nt-cat-btn${
            audienceFilter === 'all'
              ? ' active'
              : ''
          }`}
          onClick={() =>
            setAudienceFilter('all')
          }
        >
          <i className="fa-solid fa-border-all" />
          {' '}
          All
        </button>

        {AUDIENCES.filter(
          (item) => item.key !== 'all',
        ).map((item) => (
          <button
            type="button"
            key={item.key}
            className={`nt-cat-btn${
              audienceFilter === item.key
                ? ' active'
                : ''
            }`}
            onClick={() =>
              setAudienceFilter(item.key)
            }
          >
            <i
              className={`fa-solid ${item.icon}`}
            />
            {' '}
            {item.label}
          </button>
        ))}
      </div>

      <div className="nt-filter-row">
        <div className="nt-search">
          <i className="fa-solid fa-magnifying-glass" />

          <input
            type="search"
            className="sop-input"
            placeholder="Search by title or message..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>
      </div>

      {loading ? (
        <div className="nt-empty">
          Loading notifications...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="nt-empty">
          <i className="fa-solid fa-bell-slash" />

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            No Notifications Found
          </div>

          <div style={{ fontSize: 13 }}>
            Create a new notification to get started.
          </div>
        </div>
      ) : (
        filteredNotifications.map((item) => (
          <div
            className="nt-card"
            key={
              item.id ||
              `${item.title}-${item.message}`
            }
          >
            <div className="nt-icon">
              <i
                className={`fa-solid ${
                  AUD_ICON[item.audience] ||
                  'fa-bell'
                }`}
              />
            </div>

            <div className="nt-body">
              <div className="nt-title">
                {item.title}
              </div>

              <div className="nt-meta">
                <span
                  className={`nt-badge nt-aud-${item.audience}`}
                >
                  <i
                    className={`fa-solid ${
                      AUD_ICON[item.audience] ||
                      'fa-users'
                    }`}
                    style={{ fontSize: 9 }}
                  />
                  {' '}
                  {AUD_LABEL[item.audience] ||
                    item.audience}
                </span>
              </div>

              {item.message && (
                <div className="nt-msg">
                  {item.message}
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {modal && (
        <NotificationModal
          onClose={() => setModal(false)}
          onSend={sendNotification}
          estimate={getEstimatedRecipients}
        />
      )}

      {toast &&
        createPortal(
          <div className="ss-toast-wrap">
            <div
              className={`ss-toast ${toast.type}`}
            >
              <i
                className={`fa-solid ${
                  toast.type === 'success'
                    ? 'fa-circle-check'
                    : toast.type === 'warn'
                      ? 'fa-triangle-exclamation'
                      : 'fa-circle-info'
                }`}
              />
              {' '}
              {toast.message}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function normalizeAudience(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase()

  if (
    normalized === 'principal' ||
    normalized === 'principals'
  ) {
    return 'principals'
  }

  if (normalized === 'teacher' ||
      normalized === 'teachers') {
    return 'teachers'
  }

  if (normalized === 'parent' ||
      normalized === 'parents') {
    return 'parents'
  }

  return 'all'
}

function Stat({
  icon,
  value,
  label,
  className = '',
}) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-icon">
        <i className={`fa-solid ${icon}`} />
      </div>

      <div className="stat-val">
        {value}
      </div>

      <div className="stat-lbl">
        {label}
      </div>
    </div>
  )
}

function NotificationModal({
  onClose,
  onSend,
  estimate,
}) {
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'all',
  })

  const [count, setCount] = useState(null)
  const [loadingCount, setLoadingCount] =
    useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function calculateRecipients() {
      setLoadingCount(true)

      const result = await estimate(
        form.audience,
      )

      if (active) {
        setCount(result)
        setLoadingCount(false)
      }
    }

    calculateRecipients()

    return () => {
      active = false
    }
  }, [form.audience, estimate])

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    setError('')
  }

  async function submit(event) {
    event.preventDefault()

    if (!form.title.trim()) {
      setError(
        'Please enter a notification title.',
      )
      return
    }

    if (!form.message.trim()) {
      setError(
        'Please enter a notification message.',
      )
      return
    }

    try {
      setSending(true)

      const success = await onSend(form)

      if (success) onClose()
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div
      className="pay-ov"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !sending
        ) {
          onClose()
        }
      }}
    >
      <div
        className="pay-modal"
        style={{ maxWidth: 600 }}
      >
        <div className="pay-modal-hdr">
          <div className="pay-modal-av">
            <i className="fa-solid fa-bell" />
          </div>

          <div>
            <div className="pay-modal-title">
              New Notification
            </div>

            <div className="pay-modal-sub">
              Send an announcement to your chain schools
            </div>
          </div>

          <button
            type="button"
            className="pay-modal-x"
            onClick={onClose}
            disabled={sending}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div
            className="pay-modal-body"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <Field label="Title *">
              <input
                className="sop-input"
                value={form.title}
                placeholder="Enter notification title"
                onChange={(event) =>
                  updateField(
                    'title',
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Message *">
              <textarea
                className="sop-input"
                rows={4}
                value={form.message}
                placeholder="Write the announcement message..."
                onChange={(event) =>
                  updateField(
                    'message',
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Audience *">
              <div className="nt-aud-grid">
                {AUDIENCES.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={`nt-aud-card${
                      form.audience === item.key
                        ? ' sel'
                        : ''
                    }`}
                    onClick={() =>
                      updateField(
                        'audience',
                        item.key,
                      )
                    }
                  >
                    <div className="nt-aud-card-ic">
                      <i
                        className={`fa-solid ${item.icon}`}
                      />
                    </div>

                    <div>
                      <div className="nt-aud-card-t">
                        {item.label}
                      </div>

                      <div className="nt-aud-card-s">
                        {item.short}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <div className="nt-estimate">
              <i className="fa-solid fa-users" />
              {' '}
              {loadingCount
                ? 'Calculating recipients...'
                : `Estimated Recipients: ${
                    count ?? 0
                  }`}
            </div>

            {error && (
              <div className="nt-form-error">
                {error}
              </div>
            )}
          </div>

          <div className="pay-modal-foot">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={sending}
            >
              <i
                className={`fa-solid ${
                  sending
                    ? 'fa-spinner fa-spin'
                    : 'fa-paper-plane'
                }`}
              />
              {' '}
              {sending
                ? 'Sending...'
                : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }) {
  return (
    <div
      className="sop-field"
      style={{ margin: 0 }}
    >
      <label>{label}</label>
      {children}
    </div>
  )
}