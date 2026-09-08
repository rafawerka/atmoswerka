export type WeatherCheckStatus = "APPROVED" | "REJECTED";

export type WeatherCheckResult = {
  status: WeatherCheckStatus;
  motivo: string;
  lat: number;
  lon: number;
  cultura: string;
  operacao: string;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
  };
};

type OpenMeteoCurrent = {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
};

type OpenMeteoForecastResponse = {
  current: OpenMeteoCurrent;
};

export async function checkWeatherConditions(
  lat: number,
  lon: number,
  cultura: string,
  operacao: string,
): Promise<WeatherCheckResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m",
  );

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar Open-Meteo: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenMeteoForecastResponse;
  const current = data.current;
  const windSpeed = current.wind_speed_10m;

  const rejected = windSpeed > 10;

  return {
    status: rejected ? "REJECTED" : "APPROVED",
    motivo: rejected
      ? "Vento acima do limite seguro para pulverização (>10 km/h)"
      : "Condições climáticas ideais",
    lat,
    lon,
    cultura,
    operacao,
    current,
  };
}
