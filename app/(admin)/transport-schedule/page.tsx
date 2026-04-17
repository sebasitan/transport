'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Bus, Clock, MapPin, ArrowUp, ArrowDown, Truck,
  Plus, Trash2, Pencil, User, Phone, Search, X, Calendar, Filter,
  ChevronLeft, ChevronRight, Copy, CheckCircle2, Loader2, CalendarClock,
  ArrowRight
} from 'lucide-react'
import { adminFetch } from '@/lib/api-client'

// --- TYPES ---
interface StationInfo {
  _id: string
  station_name: string
  location_name: string
  status: string
}

interface DriverInfo {
  _id: string
  name: string
  phone: string
}

interface VehicleInfo {
  _id: string
  vehicle_name: string
  vehicle_number: string
  vehicle_type: string
  seat_capacity: number
  driver_id?: DriverInfo
  status: string
}

interface SlotData {
  _id: string
  vehicle_id: string | VehicleInfo
  station_name: string
  type: 'pickup' | 'drop'
  time: string
  status: 'active' | 'inactive'
  date: string
}

export default function TransportSchedulePage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([])
  const [stations, setStations] = useState<StationInfo[]>([])
  const [slots, setSlots] = useState<SlotData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'drop'>('all')

  // Date-wise Management
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editSlot, setEditSlot] = useState<SlotData | null>(null)
  const [editForm, setEditForm] = useState({ time: '', station_name: '', status: 'active' as string })
  const [form, setForm] = useState({
    vehicle_id: '',
    station_name: '',
    pickup_station: '',
    drop_station: '',
    travel_time: '30',
    type: 'both' as 'pickup' | 'drop' | 'both',
    date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '18:00',
    interval: '60',
  })

  const resetForm = (vehicleId = '', date = selectedDate) => {
    setForm({
      vehicle_id: vehicleId,
      station_name: '',
      pickup_station: '',
      drop_station: '',
      travel_time: '30',
      type: 'both',
      date,
      start_time: '07:00',
      end_time: '18:00',
      interval: '60',
    })
  }

  // Fetching Data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [vehRes, staRes, sloRes] = await Promise.all([
        adminFetch('/api/vehicles'),
        adminFetch('/api/stations'),
        adminFetch(`/api/transport/vehicle-slots?date=${selectedDate}`)
      ])

      if (!vehRes.ok || !staRes.ok || !sloRes.ok) throw new Error('Failed to load data')

      const vehJson = await vehRes.json()
      const staJson = await staRes.json()
      const sloJson = await sloRes.json()

      setVehicles(vehJson.data || [])
      setStations(staJson.data || [])
      setSlots(sloJson.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load schedule data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  // Stats for the SELECTED DATE
  const stats = useMemo(() => {
    const activeVehiclesCount = new Set(slots.map(s => typeof s.vehicle_id === 'string' ? s.vehicle_id : s.vehicle_id._id)).size
    return {
      total: slots.length,
      pickups: slots.filter(s => s.type === 'pickup').length,
      drops: slots.filter(s => s.type === 'drop').length,
      vehicles: activeVehiclesCount
    }
  }, [slots])

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return vehicles.filter(v =>
      v.status === 'active' &&
      (v.vehicle_name.toLowerCase().includes(q) || v.vehicle_number.toLowerCase().includes(q))
    )
  }, [vehicles, searchQuery])

  const vehicleSlotsMap = useMemo(() => {
    const map = new Map<string, SlotData[]>()
    slots.forEach(slot => {
      const vId = typeof slot.vehicle_id === 'object' ? slot.vehicle_id._id : slot.vehicle_id
      if (typeFilter !== 'all' && slot.type !== typeFilter) return

      if (!map.has(vId)) map.set(vId, [])
      map.get(vId)?.push(slot)
    })
    return map
  }, [slots, typeFilter])

  // Handlers
  const handleSave = async () => {
    if (!form.vehicle_id) {
      toast({ title: 'Validation Error', description: 'Please select a vehicle', variant: 'destructive' })
      return
    }
    if (form.type === 'both' && (!form.pickup_station || !form.drop_station)) {
      toast({ title: 'Validation Error', description: 'Please select both station and hospital', variant: 'destructive' })
      return
    }
    if (form.type !== 'both' && (!form.station_name || !form.date)) {
      toast({ title: 'Validation Error', description: 'Missing required fields', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const payload = form.type === 'both'
        ? {
            vehicle_id: form.vehicle_id,
            type: 'both',
            pickup_station: form.pickup_station,
            drop_station: form.drop_station,
            travel_time: form.travel_time,
            start_time: form.start_time,
            end_time: form.end_time,
            interval_minutes: form.interval,
          }
        : {
            vehicle_id: form.vehicle_id,
            station_name: form.station_name,
            type: form.type,
            date: form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            interval_minutes: form.interval,
          }

      const res = await adminFetch('/api/transport/vehicle-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast({ title: 'Schedule Built', description: `${result.count} slots deployed successfully.` })
      setDialogOpen(false)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (slotId: string) => {
    try {
      const res = await adminFetch(`/api/transport/vehicle-slots/${slotId}?date=${selectedDate}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to delete slot')
      setSlots(prev => prev.filter(s => s._id !== slotId))
      toast({ title: 'Deleted', description: result.override ? 'Slot removed for this date only.' : 'Slot removed.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const handleEditOpen = (slot: SlotData) => {
    setEditSlot(slot)
    setEditForm({ time: slot.time, station_name: slot.station_name, status: slot.status })
    setEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!editSlot) return
    setEditSaving(true)
    try {
      const res = await adminFetch(`/api/transport/vehicle-slots/${editSlot._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: editForm.time,
          station_name: editForm.station_name,
          status: editForm.status,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update slot')
      setSlots(prev => prev.map(s => s._id === editSlot._id ? { ...s, time: editForm.time, station_name: editForm.station_name, status: editForm.status as 'active' | 'inactive' } : s))
      toast({ title: 'Updated', description: 'Slot updated successfully.' })
      setEditDialogOpen(false)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleCopyForward = async () => {
    if (slots.length === 0) return
    const nextDate = new Date(selectedDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = nextDate.toISOString().split('T')[0]

    if (!confirm(`Copy this entire fleet schedule (${slots.length} slots) to ${nextDateStr}?`)) return

    setLoading(true)
    try {
       const res = await adminFetch('/api/transport/vehicle-slots', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ source_date: selectedDate, target_date: nextDateStr }),
       })
       const result = await res.json()
       if (!res.ok) throw new Error(result.error)
       toast({ title: 'Duplicated', description: `${result.count} slots copied to ${nextDateStr}.` })
       setSelectedDate(nextDateStr)
    } catch (err: any) {
       toast({ title: 'Error', description: err.message || 'Failed to replicate schedule.', variant: 'destructive' })
    } finally {
       setLoading(false)
    }
  }

  // ============================================================
  // Preview logic
  //
  // "both" mode round-trip:
  //   Pickup @ Station 07:00 → Drop @ Clinic 07:30
  //   Pickup @ Station 08:00 → Drop @ Clinic 08:30
  //   (interval = 60min, travel = 30min)
  // ============================================================
  const previewSlots = useMemo(() => {
    const pairs: { pickup: string; drop: string }[] = []
    const times: string[] = []
    const [sh, sm] = form.start_time.split(':').map(Number)
    const [eh, em] = form.end_time.split(':').map(Number)
    const startMin = sh * 60 + (sm || 0)
    const endMin = eh * 60 + (em || 0)
    const interval = parseInt(form.interval) || 60
    const travelMin = parseInt(form.travel_time) || 30
    if (interval < 5 || startMin >= endMin) return { pairs: [], times: [], totalCount: 0 }

    const fmt = (t: number) => {
      const h = Math.floor(t / 60)
      const min = t % 60
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    }

    for (let m = startMin; m < endMin; m += interval) {
      times.push(fmt(m))
      if (form.type === 'both') {
        pairs.push({ pickup: fmt(m), drop: fmt(m + travelMin) })
      }
    }
    const totalCount = form.type === 'both' ? pairs.length * 2 : times.length
    return { pairs, times, totalCount }
  }, [form])

  const formatTime12h = (timeStr: string) => {
    const [h, m] = timeStr.split(':')
    const hours = parseInt(h)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    return `${h12}:${m} ${ampm}`
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">
             Fleet Deployment Hub
          </h1>
          <p className="text-sm font-medium text-slate-500 italic">Vehicle shuttle slot management — pickup & drop round trips.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCopyForward} disabled={slots.length === 0} className="rounded-xl border-slate-200 h-11 px-6">
             <Copy className="w-4 h-4 mr-2 text-primary" /> Duplicate Tomorrow
          </Button>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6">
            <Plus className="h-4 w-4 mr-2" /> Assign New Slots
          </Button>
        </div>
      </div>

      {/* Date Master Controller */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
               <button onClick={() => {
                 const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0]);
               }} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>

               <div className="px-6 py-2 flex flex-col items-center">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Target Date</span>
                  <p className="text-lg font-black text-slate-800 tracking-tighter leading-none">
                     {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
               </div>

               <button onClick={() => {
                 const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0]);
               }} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="h-10 w-px bg-slate-100 mx-2" />
            <div className="flex gap-1">
               <Badge className={`rounded-xl px-4 py-2 text-[10px] items-center gap-2 font-black tracking-widest border-none shadow-none ${stats.total > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                  {stats.total > 0 ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {stats.total > 0 ? 'SYNCED' : 'HOLLOW'}
               </Badge>
            </div>
         </div>

         <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input placeholder="Search assigned unit..." className="pl-10 h-12 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/10 shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
               {(['all', 'pickup', 'drop'] as const).map((t) => (
                 <button key={t} onClick={() => setTypeFilter(t)} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${typeFilter === t ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}>{t}</button>
               ))}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Slots', val: stats.total, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pickup Slots', val: stats.pickups, icon: ArrowUp, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Drop Slots', val: stats.drops, icon: ArrowDown, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Active Fleet', val: stats.vehicles, icon: Truck, color: 'text-teal-600', bg: 'bg-teal-50' }
        ].map((s, idx) => (
          <Card key={idx} className={`p-6 rounded-[2rem] border-none shadow-sm ${s.bg} flex items-center justify-between group overflow-hidden relative`}>
            <div className="relative z-10">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-black tracking-tighter ${s.color}`}>{s.val}</p>
            </div>
            <s.icon className={`h-12 w-12 ${s.color} opacity-10 absolute right-4 top-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform`} />
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
          <Loader2 className="animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest">Syncing Deployment Data...</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredVehicles.map((vehicle) => {
            const vehicleSlots = (vehicleSlotsMap.get(vehicle._id) || []).sort((a, b) => a.time.localeCompare(b.time))
            if (searchQuery && vehicleSlots.length === 0 && !vehicle.vehicle_name.toLowerCase().includes(searchQuery.toLowerCase())) return null

            const pickupSlots = vehicleSlots.filter(s => s.type === 'pickup')
            const dropSlots = vehicleSlots.filter(s => s.type === 'drop')

            return (
              <Card key={vehicle._id} className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100 group">
                <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-center gap-5 text-sm">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all"><Bus className="h-6 w-6" /></div>
                    <div>
                      <h3 className="font-black text-lg text-slate-800 flex items-center gap-2 leading-none uppercase italic tracking-tighter">
                        {vehicle.vehicle_name}
                        <Badge variant="secondary" className="font-mono text-[9px] bg-white text-slate-400 border border-slate-100">{vehicle.vehicle_number}</Badge>
                      </h3>
                      {vehicle.driver_id ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-3">
                           <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 opacity-40" /> {vehicle.driver_id.name}</span>
                           <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 opacity-40" /> {vehicle.driver_id.phone}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1.5">Unassigned Operator</p>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="rounded-xl hover:bg-primary/5 hover:text-primary text-[10px] font-black uppercase tracking-widest" onClick={() => { resetForm(vehicle._id); setDialogOpen(true); }}>
                     <Plus className="h-3.5 w-3.5 mr-2" /> Add Slots
                  </Button>
                </div>
                <CardContent className="p-7">
                  {vehicleSlots.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-3 opacity-20 border-2 border-dashed border-slate-100 rounded-[2rem]">
                       <Calendar className="w-8 h-8" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No slots assigned.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Pickup Slots — Station → Clinic */}
                      {pickupSlots.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                            <ArrowUp className="w-3 h-3" /> Pickup — Station to Clinic
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {pickupSlots.map((slot) => (
                              <div key={slot._id} className="group/slot relative flex flex-col items-center justify-center w-28 h-20 rounded-[1.5rem] border transition-all bg-primary/5 border-primary/20 hover:bg-primary hover:border-primary">
                                <p className="text-base font-black tracking-tighter leading-none mb-1 group-hover/slot:text-white text-primary">{formatTime12h(slot.time)}</p>
                                <p className="text-[9px] font-black text-slate-400 group-hover/slot:text-white/60 uppercase tracking-tighter truncate max-w-[80px]">{slot.station_name}</p>
                                <button onClick={() => handleEditOpen(slot)} className="absolute -top-1.5 -left-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-blue-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Pencil className="h-3 w-3" /></button>
                                <button onClick={() => handleDelete(slot._id)} className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-red-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Drop Slots — Clinic → Station */}
                      {dropSlots.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <ArrowDown className="w-3 h-3" /> Drop — Clinic to Station
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {dropSlots.map((slot) => (
                              <div key={slot._id} className="group/slot relative flex flex-col items-center justify-center w-28 h-20 rounded-[1.5rem] border transition-all bg-orange-50 border-orange-200 hover:bg-orange-500 hover:border-orange-500">
                                <p className="text-base font-black tracking-tighter leading-none mb-1 group-hover/slot:text-white text-orange-700">{formatTime12h(slot.time)}</p>
                                <p className="text-[9px] font-black text-slate-400 group-hover/slot:text-white/60 uppercase tracking-tighter truncate max-w-[80px]">{slot.station_name}</p>
                                <button onClick={() => handleEditOpen(slot)} className="absolute -top-1.5 -left-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-blue-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Pencil className="h-3 w-3" /></button>
                                <button onClick={() => handleDelete(slot._id)} className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-white border border-slate-100 rounded-full text-red-500 opacity-0 group-hover/slot:opacity-100 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ============ DEPLOYMENT WIZARD DIALOG ============ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] max-h-[90vh] flex flex-col [&>button]:text-white [&>button]:top-8 [&>button]:right-8 [&>button]:opacity-100">
           <div className="bg-primary p-10 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Calendar className="w-40 h-40" /></div>
              <DialogHeader className="space-y-1 relative z-10">
                 <DialogTitle className="text-2xl font-black italic tracking-tighter flex items-center gap-3">
                    <CalendarClock className="w-7 h-7" /> Deployment Wizard
                 </DialogTitle>
                 <p className="text-[10px] uppercase font-black tracking-widest text-white/50">Auto-Generate Pickup & Drop Slots</p>
              </DialogHeader>
           </div>

           <div className="p-10 space-y-7 bg-white overflow-y-auto flex-1">

              {/* Vehicle + Type */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assigned Vehicle</Label>
                    <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                       <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                       <SelectContent className="rounded-2xl border-none shadow-xl">{vehicles.filter(v => v.status === 'active').map((v) => (<SelectItem key={v._id} value={v._id}>{v.vehicle_name} ({v.vehicle_number})</SelectItem>))}</SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Slot Type</Label>
                    <div className="flex p-1 bg-slate-100 rounded-2xl h-14 shadow-inner">
                       {(['both', 'pickup', 'drop'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={(e) => { e.preventDefault(); setForm({ ...form, type: t }); }}
                            className={`flex-1 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-200 ${form.type === t ? 'bg-white shadow-md text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {t}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Stations — context-aware labels */}
              {form.type === 'both' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station (Pickup Point)</Label>
                    <Select value={form.pickup_station} onValueChange={(v) => setForm({ ...form, pickup_station: v })}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="e.g. Taman Melati" /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">{stations.filter(s => s.status === 'active').map((s) => (<SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Clinic (Drop Point)</Label>
                    <Select value={form.drop_station} onValueChange={(v) => setForm({ ...form, drop_station: v })}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="e.g. Clinic KL" /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">{stations.filter(s => s.status === 'active').map((s) => (<SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station</Label>
                  <Select value={form.station_name} onValueChange={(v) => setForm({ ...form, station_name: v })}>
                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-primary/20"><SelectValue placeholder="Which station?" /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl">{stations.filter(s => s.status === 'active').map((s) => (<SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}

              {/* Time config */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Daily Start</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Operation End</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                 </div>
              </div>

              <div className={`grid gap-4 ${form.type === 'both' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cadence (Min)</Label>
                    <Input type="number" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" min="5" />
                 </div>
                 {form.type === 'both' ? (
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Travel Time (Min)</Label>
                     <Input type="number" value={form.travel_time} onChange={(e) => setForm({ ...form, travel_time: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" min="5" />
                   </div>
                 ) : (
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Target Date</Label>
                     <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                   </div>
                 )}
              </div>

              {/* Preview */}
              {previewSlots.totalCount > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                     Round-Trip Preview — {previewSlots.totalCount} slots ({form.type === 'both' ? `${previewSlots.pairs.length} trips` : `${previewSlots.times.length} slots`})
                   </p>

                   {form.type === 'both' ? (
                     <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                       {/* Header */}
                       <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-300 pb-1 border-b border-slate-100">
                         <span className="flex-1 text-primary">Pickup @ Station</span>
                         <span className="w-6" />
                         <span className="flex-1 text-orange-500">Drop @ Clinic</span>
                       </div>
                       {previewSlots.pairs.map((p, i) => (
                         <div key={i} className="flex items-center gap-2">
                           <Badge className="flex-1 justify-center px-2 py-1.5 rounded-xl text-[10px] font-black border-none shadow-none bg-primary/10 text-primary">
                             {formatTime12h(p.pickup)}
                           </Badge>
                           <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                           <Badge className="flex-1 justify-center px-2 py-1.5 rounded-xl text-[10px] font-black border-none shadow-none bg-orange-100 text-orange-700">
                             {formatTime12h(p.drop)}
                           </Badge>
                         </div>
                       ))}
                       <p className="text-[8px] text-slate-400 pt-1 text-center">Travel time: {form.travel_time} min per trip</p>
                     </div>
                   ) : (
                     <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto no-scrollbar">
                       {previewSlots.times.map(t => (
                         <Badge key={t} className={`px-2 py-0.5 rounded-lg text-[9px] font-black border-none shadow-none ${form.type === 'pickup' ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-700'}`}>
                           {formatTime12h(t)}
                         </Badge>
                       ))}
                     </div>
                   )}
                </div>
              )}

              <DialogFooter className="gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setDialogOpen(false)} className="flex-1 h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Abort</Button>
                 <Button onClick={handleSave} disabled={saving || previewSlots.totalCount === 0} className="flex-[2] h-16 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20">
                    {saving ? <Loader2 className="animate-spin" /> : `Deploy (${previewSlots.totalCount} slots)`}
                 </Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>

      {/* ============ EDIT SLOT DIALOG ============ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px] border-none shadow-2xl p-0 overflow-hidden rounded-[3rem] [&>button]:text-white [&>button]:top-6 [&>button]:right-6 [&>button]:opacity-100">
           <div className="bg-blue-600 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Pencil className="w-32 h-32" /></div>
              <DialogHeader className="space-y-1 relative z-10">
                 <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
                    <Pencil className="w-5 h-5" /> Edit Slot
                 </DialogTitle>
                 <p className="text-[10px] uppercase font-black tracking-widest text-white/50">
                   {editSlot?.type === 'pickup' ? 'Pickup' : 'Drop'} Slot
                 </p>
              </DialogHeader>
           </div>

           <div className="p-8 space-y-5 bg-white">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Time</Label>
                 <Input
                   type="time"
                   value={editForm.time}
                   onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                   className="h-14 rounded-2xl bg-slate-50 border-none font-bold"
                 />
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Station</Label>
                 <Select value={editForm.station_name} onValueChange={(v) => setEditForm({ ...editForm, station_name: v })}>
                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold ring-0 focus:ring-2 focus:ring-blue-200">
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl">
                      {stations.filter(s => s.status === 'active').map((s) => (
                        <SelectItem key={s._id} value={s.station_name}>{s.station_name}</SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status</Label>
                 <div className="flex p-1 bg-slate-100 rounded-2xl h-14 shadow-inner">
                    {(['active', 'inactive'] as const).map((s) => (
                       <button
                         key={s}
                         type="button"
                         onClick={() => setEditForm({ ...editForm, status: s })}
                         className={`flex-1 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all duration-200 ${editForm.status === s ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                       >
                         {s}
                       </button>
                    ))}
                 </div>
              </div>

              <DialogFooter className="gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="flex-1 h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest opacity-40">Cancel</Button>
                 <Button onClick={handleEditSave} disabled={editSaving || !editForm.time || !editForm.station_name} className="flex-[2] h-14 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                    {editSaving ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                 </Button>
              </DialogFooter>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
