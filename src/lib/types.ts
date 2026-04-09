/** Shared types for avalanche API responses */

export interface MapLayerFeature {
  type: "Feature";
  id: number;
  properties: {
    name: string;
    center: string;
    center_id: string;
    center_link: string;
    state: string;
    timezone: string;
    off_season: boolean;
    danger: string;
    danger_level: number;
    color: string;
    stroke: string;
    font_color: string;
    link: string;
    start_date: string;
    end_date: string;
    travel_advice: string;
    fillOpacity: number;
    fillIncrement: number;
    warning: {
      product: string | null;
    };
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

export interface MapLayerResponse {
  type: "FeatureCollection";
  features: MapLayerFeature[];
}

export interface DangerRating {
  lower: number;
  upper: number;
  middle: number;
  valid_day: "current" | "tomorrow";
}

export interface AvalancheProblem {
  id: number;
  forecast_id: number;
  avalanche_problem_id: number;
  rank: number;
  likelihood: string;
  discussion: string;
  media: {
    url: Record<string, string>;
    type: string;
    title: string | null;
    caption: string;
  } | null;
  location: string[];
  size: string[];
  name: string;
  problem_description: string;
  icon: string;
}

export interface ForecastProduct {
  id: number;
  published_time: string;
  expires_time: string;
  created_at: string;
  updated_at: string | null;
  author: string | null;
  product_type: string;
  status: string;
  bottom_line: string | null;
  hazard_discussion: string | null;
  weather_discussion: string | null;
  announcement: string | null;
  media: Array<{
    id: number;
    url: Record<string, string>;
    type: string;
    title: string | null;
    caption: string;
  }> | null;
  weather_data: unknown;
  avalanche_center: {
    id: string;
    name: string;
    url: string;
    city: string;
    state: string;
  };
  forecast_avalanche_problems: AvalancheProblem[];
  danger: DangerRating[];
  forecast_zone: Array<{
    id: number;
    name: string;
    url: string;
    zone_id: string;
    config: unknown;
  }>;
}

export interface CenterInfo {
  id: string;
  name: string;
  url: string;
  center_point: { lat: number; lng: number } | null;
  off_season: boolean;
  state: string;
  timezone: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  config: Record<string, unknown>;
  zones: Array<{
    id: number;
    name: string;
    url: string;
    zone_id: string;
    config: Record<string, unknown> | null;
    status: string;
    rank: number | null;
  }>;
}

export interface Observation {
  id: string;
  center_id: string;
  obs_source: string;
  created_at: string;
  status: string;
  observer_type: string;
  organization: string | null;
  name: string;
  start_date: string;
  activity: string[];
  location_point: { lat: number; lng: number } | null;
  location_name: string;
  route: string | null;
  instability: {
    cracking: boolean;
    collapsing: boolean;
    avalanches_caught: boolean;
    avalanches_observed: boolean;
    avalanches_triggered: boolean;
  };
  instability_summary: string | null;
  observation_summary: string | null;
  media: Array<{
    id: number;
    url: Record<string, string>;
    type: string;
    caption: string | null;
  }>;
  avalanches_summary: string | null;
  advanced_fields: {
    weather_summary: string | null;
    weather: Record<string, string> | null;
    snowpack_summary: string | null;
    avalanche_problems: unknown[];
    bottom_line: string | null;
  } | null;
  avalanches: Array<{
    date: string;
    avalancheType: string;
    cause: string;
    trigger: string;
    avgCrownDepth: number | null;
    dSize: string;
    rSize: string;
    elevation: number | null;
    aspect: string;
    slopeAngle: number | null;
    weakLayerType: string | null;
    comments: string | null;
  }>;
  zone_name: string | null;
  zone_center_id: string | null;
}

export interface ObservationListResponse {
  status: string;
  total: number;
  pages: number;
  current_page: number;
  results: Observation[];
}

export interface CanadaForecast {
  id: string;
  title: string;
  dateIssued: string;
  validUntil: string;
  forecaster: string;
  highlights: string;
  confidence: {
    rating: { value: string; display: string };
    statements: string[];
  };
  dangerRatings: Array<{
    date: { display: string; utc: string };
    ratings: {
      alp: { rating: { value: string; display: string } };
      tln: { rating: { value: string; display: string } };
      btl: { rating: { value: string; display: string } };
    };
  }>;
  problems: Array<{
    type: string;
    elevations: string[];
    aspects: string[];
    likelihood: string;
    expectedSize: { min: string; max: string };
    comment: string;
  }>;
  summaries: Array<{
    type: { value: string; display: string };
    content: string;
  }>;
  terrainAndTravelAdvice: string[];
}

export const DANGER_LABELS: Record<number, string> = {
  [-1]: "No Rating",
  0: "No Rating",
  1: "Low",
  2: "Moderate",
  3: "Considerable",
  4: "High",
  5: "Extreme",
};
