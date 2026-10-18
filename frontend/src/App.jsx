
import { useState } from 'react'
import {
  Activity, HeartPulse, Wind, Thermometer, Droplets,
  ClipboardPlus, ShieldCheck, AlertTriangle, LoaderCircle,
  UserRound, Stethoscope, Gauge, Info,
} from 'lucide-react'

const initialForm = {
  patient_id: 'TEST001',
  heart_rate: '75',
  respiratory_rate: '16',
  body_temperature: '36.8',
  oxygen_saturation: '98',
  systolic_bp: '118',
  diastolic_bp: '78',
  age: '40',
  weight: '75',
  height: '1.70',
  derived_hrv: '40',
  gender: 'Male',
}

const sections = [
  {
    title: 'Vital signs',
    fields: [
      { key: 'heart_rate', label: 'Heart rate', unit: 'bpm', icon: HeartPulse },
      { key: 'respiratory_rate', label: 'Respiratory rate', unit: 'breaths/min', icon: Wind },
      { key: 'body_temperature', label: 'Body temperature', unit: '°C', icon: Thermometer },
      { key: 'oxygen_saturation', label: 'Oxygen saturation', unit: '%', icon: Droplets },
      { key: 'systolic_bp', label: 'Systolic blood pressure', unit: 'mmHg' },
      { key: 'diastolic_bp', label: 'Diastolic blood pressure', unit: 'mmHg' },
    ],
  },
  {
    title: 'Patient details',
    fields: [
      { key: 'age', label: 'Age', unit: 'years' },
      { key: 'weight', label: 'Weight', unit: 'kg' },
      { key: 'height', label: 'Height', unit: 'm' },
      { key: 'derived_hrv', label: 'Derived HRV', unit: 'model input' },
    ],
  },
]

function Field({ field, value, onChange }) {
  const Icon = field.icon
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        {Icon && <Icon size={16} className="text-black" />}
        {field.label}
      </span>
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-black">
        <input
          className="min-w-0 flex-1 py-3 text-sm outline-none"
          type="number"
          step="any"
          value={value}
          onChange={e => onChange(e.target.value)}
          required
        />
        <span className="text-xs text-slate-400">{field.unit}</span>
      </div>
    </label>
  )
}

export default function App() {
  const [form, setForm] = useState(initialForm)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function analyzePatient(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const payload = {
        ...form,
        patient_id: form.patient_id.trim(),
        gender: form.gender,
      }

      for (const key of Object.keys(payload)) {
        if (key !== 'patient_id' && key !== 'gender') {
          payload[key] = Number(payload[key])
          if (!Number.isFinite(payload[key])) {
            throw new Error(`Please enter a valid value for ${key}.`)
          }
        }
      }

      if (!payload.patient_id) {
        throw new Error('Please enter a patient ID.')
      }

      if (payload.height <= 0 || payload.weight <= 0 || payload.age < 0) {
        throw new Error('Age, height, or weight is invalid.')
      }

      const response = await fetch('http://127.0.0.1:8001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || `Backend returned HTTP ${response.status}.`)
      }

      setResult(data)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Could not connect to the backend. Make sure FastAPI is running on port 8001 and CORS is configured.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  const anomaly = result?.prediction === -1

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-black p-3 text-white">
              <Activity size={25} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LifeGuard AI</h1>
              <p className="text-xs text-slate-500">Patient Anomaly Monitoring System</p>
            </div>
          </div>
          
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-black">MONITORING WORKSPACE</p>
          <h2 className="text-3xl font-bold tracking-tight">Patient assessment</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Enter patient measurements.
          </p>
        </div>

        

        <div className="grid items-start gap-6 lg:grid-cols-[1.45fr_0.85fr]">
          <form onSubmit={analyzePatient} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <UserRound className="text-black" size={22} />
              <div>
                <h3 className="font-bold">Patient information</h3>
                <p className="text-xs text-slate-500">Complete all required fields</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">Patient ID</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-black"
                value={form.patient_id}
                onChange={e => update('patient_id', e.target.value)}
                required
              />
            </label>

            <div>
              <h4 className="mb-4 text-sm font-bold text-slate-700">Vital signs</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {sections[0].fields.map(field => (
                  <Field key={field.key} field={field} value={form[field.key]} onChange={v => update(field.key, v)} />
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-slate-700">Patient details</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {sections[1].fields.map(field => (
                  <Field key={field.key} field={field} value={form[field.key]} onChange={v => update(field.key, v)} />
                ))}
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Gender</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                    value={form.gender}
                    onChange={e => update('gender', e.target.value)}
                  >
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </label>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} /> Assessment failed</div>
                <p className="mt-1">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="animate-spin" size={20} /> : <Activity size={20} />}
              {loading ? 'Analyzing patient...' : 'Analyze Patient'}
            </button>
          </form>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-3"><Stethoscope size={22} /></div>
                <div>
                  <h3 className="font-bold">Assessment result</h3>
                </div>
              </div>

              {!result && !loading && (
                <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center">
                  <HeartPulse size={35} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-600">No assessment yet</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Submit the patient form to view the model's actual prediction.
                  </p>
                </div>
              )}

              {loading && (
                <div className="py-12 text-center">
                  <LoaderCircle size={34} className="mx-auto animate-spin text-black" />
                  <p className="mt-3 text-sm text-slate-500">Waiting for model response...</p>
                </div>
              )}

              {result && (
                <div className={`rounded-xl border p-5 ${anomaly ? 'border-amber-200 bg-amber-50' : 'border-gray-300 bg-gray-100'}`}>
                  {anomaly
                    ? <AlertTriangle size={30} className="mb-3 text-amber-700" />
                    : <ShieldCheck size={30} className="mb-3 text-black" />}
                  <p className={`text-lg font-bold ${anomaly ? 'text-amber-900' : 'text-teal-900'}`}>
                    {anomaly ? 'Statistical Anomaly Detected' : result.prediction === 1 ? 'No Statistical Anomaly Detected' : 'Unrecognized Prediction'}
                  </p>
                  <p className="mt-2 break-words text-sm text-slate-600">
                    Patient: {result.patient_id}
                  </p>
                  <div className="mt-4 border-t border-black/10 pt-3 text-sm">
                    <div className="flex justify-between gap-3 py-1">
                      <span>Prediction</span><strong>{result.prediction ?? 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between gap-3 py-1">
                      <span>Anomaly score</span><strong>{Number.isFinite(Number(result.anomaly_score)) ? Number(result.anomaly_score).toFixed(5) : 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between gap-3 py-1">
                      <span>Desktop alert triggered</span><strong>{result.notification_triggered === true ? 'Yes' : result.notification_triggered === false ? 'No' : 'Unknown'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {result && (
                <div className="mt-5 space-y-3">
                  <h4 className="text-sm font-bold">Derived measurements</h4>
                  {[
                    ['BMI', result.bmi],
                    ['Pulse pressure', result.pulse_pressure],
                    ['Mean arterial pressure', result.mean_arterial_pressure],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3 text-sm">
                      <span className="text-slate-600">{label}</span>
                      <strong>{Number.isFinite(Number(value)) ? Number(value).toFixed(2) : 'N/A'}</strong>
                    </div>
                  ))}
                </div>
              )}

              {result && (
                <div className="mt-4 flex gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                  <Info size={18} className="mt-0.5 shrink-0" />
                  {result.notice || 'This statistical anomaly result is not a medical diagnosis or a validated prediction of patient deterioration.'}
                </div>
              )}
            </div>

            
          </aside>
        </div>

        <footer className="py-8 text-center text-xs leading-5 text-slate-400">
          LifeGuard AI · Prototype for statistical anomaly monitoring 
        </footer>
      </main>
    </div>
  )
}
