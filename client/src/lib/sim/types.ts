// Shared types for the simulation: the game content, a player's design, and the
// result of simulating it. No runtime code here.
//
// Content types mirror the JSON files in /content (snake_case, units in the
// field names). Everything the simulation produces uses camelCase with units in
// the names.

// ---------------------------------------------------------------- content ---

export interface Sourced {
  source: string
  retrieved: string
  estimated?: boolean
  estimate_basis?: string
  notes?: string
}

export type Tier = 'simple' | 'advanced'

interface PartBase extends Sourced {
  id: string
  name: string
  manufacturer: string
  mass_kg: number
  /** Negative draws power, positive generates it. */
  power_w: number
  standby_power_w?: number
  cost_musd: number
  price_source?: string
  tier: Tier
  description: string
  why_it_matters: string
  fits_form_factors_u?: number[]
}

export interface StructurePart extends PartBase {
  category: 'structure'
  form_factor_u: number
  body_size_mm: [number, number, number]
  max_mass_kg: number
  size_source: string
}

export interface SolarArrayPart extends PartBase {
  category: 'solar_array'
  deployed_area_m2?: number
}

export interface BatteryPart extends PartBase {
  category: 'battery'
  capacity_wh: number
}

export interface RadioPart extends PartBase {
  category: 'communications'
  max_data_rate_mbps: number
  frequency_mhz: number
  rf_power_w: number
  two_way: boolean
  antenna_name: string
  antenna_gain_dbi: number
  antenna_mass_kg: number
  antenna_source: string
}

export interface ComputerPart extends PartBase {
  category: 'computer'
  storage_gb: number
}

export interface AttitudeControlPart extends PartBase {
  category: 'attitude_control'
  pointing_accuracy_deg?: number
}

export interface ThermalPart extends PartBase {
  category: 'thermal'
}

export interface PropulsionPart extends PartBase {
  category: 'propulsion'
  propellant_kg: number
  isp_s: number
  thrust_mn: number
  total_impulse_ns?: number
}

export type Component =
  | StructurePart
  | SolarArrayPart
  | BatteryPart
  | RadioPart
  | ComputerPart
  | AttitudeControlPart
  | ThermalPart
  | PropulsionPart

export type ComponentCategory = Component['category']

export interface Instrument extends PartBase {
  category: 'instrument'
  data_rate_mbps: number
  science_value: number
  compatible_objectives: string[]
  limitation?: string
  ground_resolution_m_at_500km: number
  swath_km_at_500km: number
  band_count: number
  has_near_infrared: boolean
  volume_u?: number
  storage_gb?: number
}

export interface Launcher extends Sourced {
  id: string
  name: string
  provider: string
  launch_type: 'dedicated' | 'rideshare'
  cost_musd: number
  included_mass_kg?: number
  extra_cost_musd_per_kg?: number
  price_source?: string
  /** null means the launcher does not fly to that orbit. */
  capacity_kg_by_orbit: Record<string, number | null>
  fairing_diameter_m: number
  fairing_height_m: number
  launch_attempts: number
  launch_successes: number
  record_as_of: string
  record_source: string
  description: string
  why_it_matters: string
}

export interface Orbit extends Sourced {
  id: string
  name: string
  altitude_km: number
  inclination_deg: number
  eccentricity: number
  sun_synchronous: boolean
  local_time_descending_node?: string
  description: string
  why_it_matters: string
}

export interface GroundStation extends Sourced {
  id: string
  name: string
  operator: string
  antenna_name: string
  antenna_diameter_m: number
  latitude_deg: number
  longitude_deg: number
  s_band_rx_min_mhz?: number
  s_band_rx_max_mhz?: number
  s_band_g_over_t_db_k?: number
  x_band_rx_min_mhz?: number
  x_band_rx_max_mhz?: number
  x_band_g_over_t_db_k?: number
  cost_usd_per_pass: number
  price_source?: string
  description: string
  why_it_matters: string
}

export type RequirementMetric =
  | 'revisit_days'
  | 'ground_resolution_m'
  | 'data_returned_gb_per_month'
  | 'lifetime_years'

export interface Requirement {
  id: string
  label: string
  metric: RequirementMetric
  comparator: '<=' | '>='
  threshold: number
  unit: string
  why_it_matters: string
}

export interface Scenario extends Sourced {
  id: string
  name: string
  mission_type: 'earth-observation'
  objective_id: string
  summary: string
  objective: string
  budget_musd: number
  planned_lifetime_years: number
  requirements: Requirement[]
  real_mission_name: string
  real_mission_fact: string
  real_mission_source: string
}

/** Everything a player can choose from: the contents of /content. */
export interface Catalog {
  components: Component[]
  instruments: Instrument[]
  launchers: Launcher[]
  orbits: Orbit[]
  groundStations: GroundStation[]
}

// ----------------------------------------------------------------- events ---

/**
 * What a random event does. Events are data (events.json, build step 8); the
 * simulation only knows these kinds.
 */
export type EventEffect =
  /** One booked ground station, picked at random, is out of service. */
  | { kind: 'station_outage'; duration_days: number }
  /** The spacecraft stops imaging and sending data while it recovers. */
  | { kind: 'safe_mode'; duration_days: number }
  /** The solar array permanently loses part of its output. */
  | { kind: 'array_damage'; power_loss_fraction: number }

export interface MissionEvent {
  id: string
  name: string
  /** Chance that the event happens at least once in a year, 0 to 1. */
  probability_per_year: number
  effect: EventEffect
}

// ----------------------------------------------------------------- design ---

/** One ground station booked for a number of passes each day. */
export interface StationBooking {
  stationId: string
  passesPerDay: number
}

/**
 * A player's mission design. Every choice is an id into the catalogue; null
 * means "not chosen yet", so an unfinished design is still a valid value.
 */
export interface Design {
  orbitId: string | null
  launcherId: string | null
  structureId: string | null
  solarArrayId: string | null
  batteryId: string | null
  computerId: string | null
  attitudeControlId: string | null
  propulsionId: string | null
  radioIds: string[]
  instrumentIds: string[]
  groundStations: StationBooking[]
  /** Minutes of imaging the team plans for each day. */
  imagingMinutesPerDay: number
}

/** A complete design from /content/ready_designs.json, for players who would rather not pick every part. */
export interface ReadyDesign extends Sourced {
  id: string
  scenario_id: string
  name: string
  summary: string
  trade_off: string
  design: Design
}

export type Difficulty = 'concept' | 'trade-study' | 'point-design'

/** Everything `simulate` needs besides the design, the scenario and the seed. */
export interface SimulationContext {
  catalog: Catalog
  difficulty: Difficulty
  /** Sandbox mode: constraints warn but never stop the launch. */
  sandbox?: boolean
  /** Random events that can happen. Ignored at difficulties with events off. */
  events?: MissionEvent[]
  /**
   * Team mode only: how well the team worked together, 0 to 1. Measured by the
   * multiplayer layer, not by the simulation. Leave out for a solo game.
   */
  collaboration?: number
}

// ----------------------------------------------------------------- checks ---

export type CheckId =
  | 'design_incomplete'
  | 'unknown_part'
  | 'orbit_not_served'
  | 'launch_mass'
  | 'cubesat_mass'
  | 'part_fit'
  | 'instrument_volume'
  | 'budget'
  | 'solar_array'
  | 'battery'
  | 'radio'
  | 'pointing'
  | 'instrument'
  | 'ground_station'
  | 'station_link'
  | 'station_passes'
  | 'command_link'
  | 'power'
  | 'battery_depth'
  | 'data_downlink'
  | 'orbit_lifetime'

/**
 * ok: fine. risk: the mission may launch but is likely to underperform or
 * fail. blocked: the mission cannot launch until this is fixed.
 */
export type CheckStatus = 'ok' | 'risk' | 'blocked'

export type TextValues = Record<string, number | string>

export interface ConstraintCheck {
  id: CheckId
  status: CheckStatus
  /** Numbers and names for the explanation text (see /lib/strings). */
  values: TextValues
}

// ------------------------------------------------------------ simulation ----

export type MissionStatus =
  | 'completed'
  | 'not_launched'
  | 'launch_failed'
  | 'reentered'
  | 'power_lost'

export interface StepLog {
  /** Day of the mission, starting at 1. */
  day: number
  altitudeKm: number
  /** Solar array output in sunlight. */
  sunlitPowerW: number
  /** Generation averaged over the day's orbits. */
  generationW: number
  /** Consumption averaged over the day's orbits. */
  consumptionW: number
  /** Fraction of the battery used in each eclipse; null without a battery. */
  depthOfDischarge: number | null
  /** Fraction of the planned imaging that was done, 0 to 1. */
  imagingActivity: number
  /** Fraction of the booked downlink time that was used for sending, 0 to 1. */
  downlinkActivity: number
  dataGeneratedGb: number
  dataDownlinkedGb: number
  dataStoredGb: number
  dataLostGb: number
  propellantKg: number
  /** Solar array output compared with new, 0 to 1. */
  arrayHealth: number
  /** Ids of the events that started today. */
  events: string[]
}

export interface EventOccurrence {
  day: number
  eventId: string
  /** The station hit by an outage. */
  stationId?: string
}

export interface MissionTotals {
  operatedDays: number
  dataGeneratedGb: number
  dataDownlinkedGb: number
  /** Downlinked data from instruments that serve the objective. */
  scienceDataGb: number
  dataLostGb: number
  /** Data still on board when the mission ended. */
  dataStrandedGb: number
  propellantUsedKg: number
  finalAltitudeKm: number
  costMusd: number
  massKg: number
}

export interface RequirementResult {
  id: string
  metric: RequirementMetric
  comparator: '<=' | '>='
  threshold: number
  unit: string
  /** null means the quantity was never achieved at all. */
  value: number | null
  met: boolean
  /** 1 when met, otherwise how close the mission came, 0 to 1. */
  achievement: number
}

export interface ScorePart {
  id: 'requirements' | 'survival' | 'efficiency' | 'collaboration'
  /** Points this part can give. */
  weight: number
  /** How much of it was earned, 0 to 1. */
  fraction: number
  points: number
}

export interface ScoreBreakdown {
  /** 0 to 100. */
  total: number
  parts: ScorePart[]
}

export type CauseId =
  | 'not_launched'
  | 'launch_failed'
  | 'reentered'
  | 'power_lost_array'
  | 'power_lost_battery'
  | 'power_shortage'
  | 'thruster_off'
  | 'thruster_unpointed'
  | 'propellant_empty'
  | 'no_downlink'
  | 'no_instrument'
  | 'instrument_unsuitable'
  | 'no_pointing'
  | 'no_command_link'
  | 'data_lost'
  | 'eclipse_transmit_blocked'
  | 'resolution_missed'
  | 'revisit_swath'
  | 'revisit_data'
  | 'data_downlink_limited'
  | 'data_imaging_limited'
  | 'event'
  | 'all_requirements_met'

export interface Cause {
  id: CauseId
  severity: 'info' | 'warning' | 'failure'
  values: TextValues
}

export interface SimulationResult {
  seed: number
  scenarioId: string
  difficulty: Difficulty
  sandbox: boolean
  plannedDays: number
  outcome: {
    status: MissionStatus
    /** Last day the spacecraft worked. 0 if it never reached orbit. */
    endDay: number
  }
  /** One entry per day flown. Empty if the mission never reached orbit. */
  steps: StepLog[]
  events: EventOccurrence[]
  totals: MissionTotals
  requirements: RequirementResult[]
  checks: ConstraintCheck[]
  score: ScoreBreakdown
  causes: Cause[]
}
