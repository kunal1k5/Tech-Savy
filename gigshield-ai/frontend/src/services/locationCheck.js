import api from "./api";

export const SAMPLE_LOCATION_PAYLOAD = {
  current_location: "Zone-A",
  time: "14:00",
  actual_location: "Zone-Z",
};

export async function fetchLocationCheck(payload = SAMPLE_LOCATION_PAYLOAD) {
  const response = await api.post("/location-check", payload);
  return response.data;
}
