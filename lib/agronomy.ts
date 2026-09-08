export type WeatherCheckStatus = "APPROVED" | "REJECTED";
export type Semaforo = "GREEN" | "YELLOW" | "RED";
export type MetricAlert = "ok" | "warning" | "alert";

export type MetricAlerts = {
  wind: MetricAlert;
  temperature: MetricAlert;
  humidity: MetricAlert;
  rain: MetricAlert;
};

export type WeatherCheckResult = {
  status: WeatherCheckStatus;
  semaforo: Semaforo;
  motivo: string;
  motivoDetalhado: string;
  lat: number;
  lon: number;
  cultura: string;
  operacao: string;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation_probability: number;
  };
  metricAlerts: MetricAlerts;
};

type OpenMeteoCurrent = {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
};

type OpenMeteoForecastResponse = {
  current: OpenMeteoCurrent;
  hourly: {
    time: string[];
    precipitation_probability: number[];
  };
};

type WeatherSnapshot = {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  precipitation_probability: number;
};

type OperationKey =
  | "pulverizacao"
  | "semeadura"
  | "colheita"
  | "irrigacao"
  | "adubacao";

function precipitationAtCurrentHour(
  currentTime: string,
  hourly: OpenMeteoForecastResponse["hourly"],
): number {
  const currentMs = Date.parse(currentTime);
  let index = 0;

  for (let i = 0; i < hourly.time.length; i += 1) {
    const slotMs = Date.parse(hourly.time[i]);
    if (Number.isNaN(slotMs) || Number.isNaN(currentMs)) break;
    if (slotMs <= currentMs) {
      index = i;
    } else {
      break;
    }
  }

  const probability = hourly.precipitation_probability[index];

  if (typeof probability !== "number" || Number.isNaN(probability)) {
    throw new Error("Open-Meteo não retornou a probabilidade de chuva.");
  }

  return probability;
}

function normalizeOperation(operacao: string): OperationKey {
  const name = operacao.trim().toLowerCase();
  if (name === "pulverização" || name === "pulverizacao") return "pulverizacao";
  if (name === "semeadura" || name === "plantio") return "semeadura";
  if (name === "colheita") return "colheita";
  if (name === "irrigação" || name === "irrigacao") return "irrigacao";
  if (name === "adubação" || name === "adubacao") return "adubacao";
  throw new Error(`Operação agrícola não suportada: ${operacao}`);
}

function worseAlert(a: MetricAlert, b: MetricAlert): MetricAlert {
  const rank = { ok: 0, warning: 1, alert: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function fmt(value: number, digits = 1) {
  return value.toFixed(digits);
}

/**
 * Aplica limites de vento, umidade, chuva e temperatura por operação.
 */
function evaluateOperation(
  operacao: string,
  weather: WeatherSnapshot,
): {
  rejected: boolean;
  semaforo: Semaforo;
  motivo: string;
  motivoDetalhado: string;
  metricAlerts: MetricAlerts;
} {
  const wind = weather.wind_speed_10m;
  const humidity = weather.relative_humidity_2m;
  const rainChance = weather.precipitation_probability;
  const temperature = weather.temperature_2m;
  const key = normalizeOperation(operacao);

  const alerts: MetricAlerts = {
    wind: "ok",
    temperature: "ok",
    humidity: "ok",
    rain: "ok",
  };
  const rejectReasons: string[] = [];
  const cautionReasons: string[] = [];
  const okReasons: string[] = [];

  if (temperature > 35) {
    alerts.temperature = "alert";
    cautionReasons.push(
      `Temperatura em ${fmt(temperature)} °C, acima de 35 °C. Impacto: evaporação acelerada da calda ou da umidade do solo, com perda de eficiência do manejo.`,
    );
  } else if (temperature > 32) {
    alerts.temperature = "warning";
    cautionReasons.push(
      `Temperatura em ${fmt(temperature)} °C, acima da faixa ideal (até 32 °C). Impacto: maior evaporação por calor e risco de a aplicação não atingir o alvo com a dose prevista.`,
    );
  } else if (temperature < 10) {
    alerts.temperature = "warning";
    cautionReasons.push(
      `Temperatura em ${fmt(temperature)} °C, abaixo de 10 °C. Impacto: menor desempenho fisiológico da cultura e possível falha de estabelecimento.`,
    );
  } else {
    okReasons.push(`Temperatura em ${fmt(temperature)} °C, dentro da faixa ideal.`);
  }

  if (key === "pulverizacao") {
    if (wind > 10) {
      alerts.wind = "alert";
      rejectReasons.push(
        `Vento em ${fmt(wind)} km/h, acima do limite de 10 km/h. Impacto: risco de deriva do defensivo para talhões vizinhos e falha de cobertura.`,
      );
    } else if (wind > 7) {
      alerts.wind = "warning";
      cautionReasons.push(
        `Vento em ${fmt(wind)} km/h, próximo do limite de 10 km/h. Impacto: deriva inicial das gotas; operar com bico de maior gota e barra mais baixa.`,
      );
    } else {
      okReasons.push(`Vento em ${fmt(wind)} km/h, abaixo do limite de 10 km/h para pulverização.`);
    }

    if (humidity < 40) {
      alerts.humidity = worseAlert(alerts.humidity, "warning");
      cautionReasons.push(
        `Umidade em ${fmt(humidity, 0)}%, abaixo de 40%. Impacto: gotas evaporam no ar e a calda chega desuniformemente à lavoura.`,
      );
    } else {
      okReasons.push(`Umidade em ${fmt(humidity, 0)}%, adequada para manter a gota até o alvo.`);
    }

    if (rainChance > 50) {
      alerts.rain = "warning";
      cautionReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%. Impacto: risco de lavagem do produto recém-aplicado.`,
      );
    } else {
      okReasons.push(`Chuva em ${fmt(rainChance, 0)}%, sem indício relevante de lavagem.`);
    }
  } else if (key === "semeadura") {
    if (wind > 25) {
      alerts.wind = "alert";
      rejectReasons.push(
        `Vento em ${fmt(wind)} km/h, acima de 25 km/h. Impacto: risco de erosão da semente e profundidade irregular de plantio.`,
      );
    } else if (wind > 18) {
      alerts.wind = "warning";
      cautionReasons.push(
        `Vento em ${fmt(wind)} km/h, elevado para semeadura. Impacto: solo solto pode deslocar semente recém-colocada.`,
      );
    } else {
      okReasons.push(`Vento em ${fmt(wind)} km/h, abaixo do limite de 25 km/h.`);
    }

    if (rainChance > 80) {
      alerts.rain = "alert";
      rejectReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%, acima de 80%. Impacto: risco de erosão da semente e crosta superficial que impede a emergência.`,
      );
    } else if (rainChance > 55) {
      alerts.rain = "warning";
      cautionReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%. Impacto: chuva forte pode lavar ou enterrar irregularmente a semente.`,
      );
    } else {
      okReasons.push(`Chuva em ${fmt(rainChance, 0)}%, abaixo do limite de rejeição (80%).`);
    }

    if (humidity > 85) {
      alerts.humidity = "warning";
      cautionReasons.push(
        `Umidade em ${fmt(humidity, 0)}%. Impacto: solo muito úmido favorece compactação na linha de plantio.`,
      );
    } else {
      okReasons.push(`Umidade em ${fmt(humidity, 0)}%, compatível com o plantio.`);
    }
  } else if (key === "colheita") {
    if (humidity > 70) {
      alerts.humidity = "alert";
      rejectReasons.push(
        `Umidade em ${fmt(humidity, 0)}%, acima de 70%. Impacto: grão úmido, maior risco de perdas, fermentação e desconto na classificação.`,
      );
    } else if (humidity > 58) {
      alerts.humidity = "warning";
      cautionReasons.push(
        `Umidade em ${fmt(humidity, 0)}%, próxima de 70%. Impacto: umidade de colheita elevada; o grão pode exigir secagem extra.`,
      );
    } else {
      okReasons.push(`Umidade em ${fmt(humidity, 0)}%, abaixo do limite de 70% para colheita.`);
    }

    if (rainChance > 30) {
      alerts.rain = "alert";
      rejectReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%, acima de 30%. Impacto: lavagem, acamamento e perdas de grão no campo.`,
      );
    } else if (rainChance > 18) {
      alerts.rain = "warning";
      cautionReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%. Impacto: chuva na colheita aumenta umidade do grão e perdas na plataforma.`,
      );
    } else {
      okReasons.push(`Chuva em ${fmt(rainChance, 0)}%, abaixo do limite de 30%.`);
    }

    if (wind > 28) {
      alerts.wind = "warning";
      cautionReasons.push(
        `Vento em ${fmt(wind)} km/h. Impacto: perdas de grão na plataforma e desuniformidade de corte.`,
      );
    } else {
      okReasons.push(`Vento em ${fmt(wind)} km/h, sem prejuízo relevante à colheita.`);
    }
  } else if (key === "irrigacao") {
    if (rainChance > 60) {
      alerts.rain = "alert";
      rejectReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%, acima de 60%. Impacto: desperdício de água e energia, pois a chuva deve irrigar o talhão.`,
      );
    } else if (rainChance > 40) {
      alerts.rain = "warning";
      cautionReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%. Impacto: parte da lâmina aplicada pode ser desnecessária se a chuva se confirmar.`,
      );
    } else {
      okReasons.push(`Chuva em ${fmt(rainChance, 0)}%, abaixo do limite de 60% para irrigação.`);
    }

    if (wind > 22) {
      alerts.wind = "warning";
      cautionReasons.push(
        `Vento em ${fmt(wind)} km/h. Impacto: aspersão irregular e evaporação da lâmina no ar.`,
      );
    } else {
      okReasons.push(`Vento em ${fmt(wind)} km/h, adequado para irrigação.`);
    }

    if (humidity < 35 && alerts.temperature !== "ok") {
      alerts.humidity = "warning";
      cautionReasons.push(
        `Umidade em ${fmt(humidity, 0)}%. Impacto: ambiente seco reforça a evaporação da água aplicada.`,
      );
    } else {
      okReasons.push(`Umidade em ${fmt(humidity, 0)}%, sem restrição crítica à irrigação.`);
    }
  } else {
    if (wind > 20) {
      alerts.wind = "alert";
      rejectReasons.push(
        `Vento em ${fmt(wind)} km/h, acima de 20 km/h. Impacto: deriva e distribuição irregular do adubo no talhão.`,
      );
    } else if (wind > 14) {
      alerts.wind = "warning";
      cautionReasons.push(
        `Vento em ${fmt(wind)} km/h, próximo do limite de 20 km/h. Impacto: faixas de adubação desuniformes.`,
      );
    } else {
      okReasons.push(`Vento em ${fmt(wind)} km/h, abaixo do limite de 20 km/h para adubação.`);
    }

    if (rainChance > 55) {
      alerts.rain = "warning";
      cautionReasons.push(
        `Probabilidade de chuva em ${fmt(rainChance, 0)}%. Impacto: risco de lavagem do fertilizante antes da incorporação.`,
      );
    } else {
      okReasons.push(`Chuva em ${fmt(rainChance, 0)}%, sem indício forte de lavagem do adubo.`);
    }

    if (humidity > 88) {
      alerts.humidity = "warning";
      cautionReasons.push(
        `Umidade em ${fmt(humidity, 0)}%. Impacto: solo encharcado reduz a eficiência da adubação e favorece perdas.`,
      );
    } else {
      okReasons.push(`Umidade em ${fmt(humidity, 0)}%, compatível com a adubação.`);
    }
  }

  const rejected = rejectReasons.length > 0;
  const hasCaution =
    cautionReasons.length > 0 ||
    Object.values(alerts).some((level) => level !== "ok");

  const semaforo: Semaforo = rejected ? "RED" : hasCaution ? "YELLOW" : "GREEN";

  const motivo = rejected
    ? rejectReasons[0].split(". Impacto:")[0]
    : hasCaution
      ? "Condições com atenção: métrica fora da faixa ideal"
      : "Condições climáticas ideais";

  const motivoDetalhado = rejected
    ? rejectReasons.concat(cautionReasons).join(" ")
    : hasCaution
      ? cautionReasons.join(" ")
      : `Todas as métricas dentro do padrão ideal para ${operacao}. ${okReasons.join(" ")} Sem risco relevante de deriva por vento, evaporação por calor ou lavagem por chuva.`;

  return {
    rejected,
    semaforo,
    motivo,
    motivoDetalhado,
    metricAlerts: alerts,
  };
}

/**
 * Consulta Open-Meteo e aplica as regras agronômicas da operação.
 */
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
  url.searchParams.set("hourly", "precipitation_probability");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar Open-Meteo: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenMeteoForecastResponse;
  const current = data.current;
  const weather: WeatherSnapshot = {
    temperature_2m: current.temperature_2m,
    relative_humidity_2m: current.relative_humidity_2m,
    wind_speed_10m: current.wind_speed_10m,
    precipitation_probability: precipitationAtCurrentHour(
      current.time,
      data.hourly,
    ),
  };

  const evaluation = evaluateOperation(operacao, weather);

  return {
    status: evaluation.rejected ? "REJECTED" : "APPROVED",
    semaforo: evaluation.semaforo,
    motivo: evaluation.motivo,
    motivoDetalhado: evaluation.motivoDetalhado,
    lat,
    lon,
    cultura,
    operacao,
    current: weather,
    metricAlerts: evaluation.metricAlerts,
  };
}
