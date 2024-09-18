import { parse } from 'papaparse';
import { ema, sma, rsi, macd, bollingerBand, atr } from "react-financial-charts";

export function parseCSV(csvText) {
  console.log('Worker: Starting CSV parsing');
  return new Promise((resolve, reject) => {
    parse(csvText, {
      complete: (results) => {
        console.log('Worker: CSV parsing complete, rows:', results.data.length);
        const parsedData = results.data
          .slice(1)
          .map(row => ({
            date: new Date(row[1]),
            open: parseFloat(row[3]),
            high: parseFloat(row[4]),
            low: parseFloat(row[5]),
            close: parseFloat(row[6]),
            volume: parseInt(row[7])
          }))
          .filter(d => !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close) && !isNaN(d.volume));
        console.log('Worker: Data processed, valid rows:', parsedData.length);
        resolve(parsedData);
      },
      error: (error) => {
        console.error('Worker: Error parsing CSV:', error);
        reject(error);
      }
    });
  });
}

export function calculateIndicators(data, indicators) {
  console.log('Worker: Starting indicator calculations');
  let calculatedData = [...data];

  if (indicators.sma) {
    console.log('Worker: Calculating SMA');
    const sma20 = sma()
      .options({ windowSize: 20 })
      .accessor(d => d.close)
      .merge((d, c) => { d.sma20 = c; });
    calculatedData = sma20(calculatedData);
  }

  if (indicators.ema) {
    const ema50 = ema()
      .options({ windowSize: 50 })
      .accessor(d => d.close)
      .merge((d, c) => { d.ema50 = c; });
    calculatedData = ema50(calculatedData);
  }

  if (indicators.bb) {
    const bb = bollingerBand()
      .options({ windowSize: 20, multiplier: 2 })
      .accessor(d => d.close)
      .merge((d, c) => { d.bb = c; });
    calculatedData = bb(calculatedData);
  }

  if (indicators.rsi) {
    const rsiCalculator = rsi()
      .options({ windowSize: 14 })
      .accessor(d => d.close)
      .merge((d, c) => { d.rsi = c; });
    calculatedData = rsiCalculator(calculatedData);
  }

  if (indicators.macd) {
    const macdCalculator = macd()
      .options({
        fast: 12,
        slow: 26,
        signal: 9,
      })
      .accessor(d => d.close)
      .merge((d, c) => { d.macd = c; });
    calculatedData = macdCalculator(calculatedData);
  }

  if (indicators.atr) {
    const atrCalculator = atr()
      .options({ windowSize: 14 })
      .merge((d, c) => { d.atr = c; });
    calculatedData = atrCalculator(calculatedData);
  }

  console.log('Worker: Indicator calculations complete');
  return calculatedData;
}

// Volume profile calculation
export function calculateVolumeProfile(data, levels = 30) {
  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const priceRange = maxPrice - minPrice;
  const levelSize = priceRange / levels;

  const volumeProfile = Array(levels).fill(0).map((_, i) => ({
    price: minPrice + i * levelSize,
    volume: 0
  }));

  data.forEach(candle => {
    const levelIndex = Math.floor((candle.close - minPrice) / levelSize);
    if (levelIndex >= 0 && levelIndex < levels) {
      volumeProfile[levelIndex].volume += candle.volume;
    }
  });

  return volumeProfile;
}

// Calculate support and resistance levels
export function calculateSupportResistance(data, periods = 14, threshold = 0.01) {
  const levels = [];
  for (let i = periods; i < data.length - periods; i++) {
    const currentPrice = data[i].close;
    const leftPrices = data.slice(i - periods, i).map(d => d.close);
    const rightPrices = data.slice(i + 1, i + periods + 1).map(d => d.close);

    if (Math.min(...rightPrices) > currentPrice && Math.min(...leftPrices) > currentPrice) {
      levels.push({ price: currentPrice, type: 'support' });
    }

    if (Math.max(...rightPrices) < currentPrice && Math.max(...leftPrices) < currentPrice) {
      levels.push({ price: currentPrice, type: 'resistance' });
    }
  }

  // Filter out levels that are too close to each other
  return levels.filter((level, index, self) =>
    index === self.findIndex(t => Math.abs(t.price - level.price) / level.price < threshold)
  );
}
