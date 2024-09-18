import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import { scaleTime } from "d3-scale";
import { ChartCanvas, Chart } from "react-financial-charts";
import { XAxis, YAxis } from "react-financial-charts";
import { CandlestickSeries, LineSeries, BarSeries } from "react-financial-charts";
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY } from "react-financial-charts";
import { discontinuousTimeScaleProviderBuilder } from "react-financial-charts";
import { lastVisibleItemBasedZoomAnchor } from "react-financial-charts";
import { HoverTooltip, OHLCTooltip, MovingAverageTooltip } from "react-financial-charts";
import { ema, sma, rsi, macd, bollingerBand, atr } from "react-financial-charts";
import { ZoomButtons, PriceCoordinate } from "react-financial-charts";
import { DrawingObjectSelector } from "react-financial-charts";
import { FibonacciRetracement, TrendLine, InteractiveYCoordinate } from "react-financial-charts";
import { useTheme } from '@mui/material/styles';
import { Button, Select, MenuItem, FormControl, InputLabel, Box, CircularProgress, Typography, Alert, Snackbar } from '@mui/material';
import { createWorkerFactory, useWorker } from '@shopify/react-web-worker';

const VolumeProfiler = lazy(() => import('./VolumeProfiler'));
const NewsEvents = lazy(() => import('./NewsEvents'));

const createWorker = createWorkerFactory(() => import('./chartWorker'));

const ForexChart = () => {
    const [data, setData] = useState([]);
    const [displayData, setDisplayData] = useState([]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [chartType, setChartType] = useState('candlestick');
    const [indicators, setIndicators] = useState({ sma: true, ema: true, rsi: true, macd: true, bb: false, atr: false });
    const [timeframe, setTimeframe] = useState('1D');
    const [layout, setLayout] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const chartRef = useRef(null);
    const theme = useTheme();
    const worker = useWorker(createWorker);

    useEffect(() => {
        const updateDimensions = () => {
            if (chartRef.current) {
                setDimensions({
                    width: window.innerWidth,
                    height: window.innerHeight,
                });
            }
        };

        window.addEventListener('resize', updateDimensions);
        updateDimensions();

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar({ ...snackbar, open: false });
    };

    const handleFileUpload = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) {
            showSnackbar('No file selected', 'warning');
            return;
        }

        setIsLoading(true);
        setError(null);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Data processing timed out')), 30000)
        );

        try {
            const text = await file.text();
            console.log('File content loaded, length:', text.length);

            const dataPromise = worker.parseCSV(text).then(parsedData => {
                console.log('Data parsed, length:', parsedData.length);
                return parsedData;
            });

            const parsedData = await Promise.race([dataPromise, timeoutPromise]);

            if (parsedData.length === 0) {
                throw new Error('No valid data found in the file');
            }

            setData(parsedData);
            const downsampledData = downsampleData(parsedData, 1000);
            console.log('Data downsampled, length:', downsampledData.length);
            setDisplayData(downsampledData);
            showSnackbar('Data loaded successfully', 'success');
        } catch (err) {
            console.error("Error processing file:", err);
            setError(err.message || "Failed to process the file. Please check the file format and try again.");
            showSnackbar('Error loading data', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [worker]);

    const downsampleData = (data, targetLength) => {
        const step = Math.ceil(data.length / targetLength);
        return data.filter((_, index) => index % step === 0);
    };

    const xScaleProvider = useMemo(() =>
        discontinuousTimeScaleProviderBuilder().inputDateAccessor(d => d.date),
        []
    );

    const { data: scaledData, xScale, xAccessor, displayXAccessor } = useMemo(() => {
        if (displayData.length === 0) {
            return { data: [], xScale: null, xAccessor: d => d.date, displayXAccessor: d => d.date };
        }
        return xScaleProvider(displayData);
    }, [xScaleProvider, displayData]);

    const calculatedData = useMemo(() => {
        if (scaledData.length === 0) return [];
        return worker.calculateIndicators(scaledData, indicators);
    }, [worker, scaledData, indicators]);

    const xExtents = useMemo(() => {
        if (calculatedData.length === 0) return [new Date(0), new Date()];
        const max = xAccessor(calculatedData[calculatedData.length - 1]);
        const min = xAccessor(calculatedData[Math.max(0, calculatedData.length - 100)]);
        return [min, max];
    }, [calculatedData, xAccessor]);

    const yExtents = useCallback((d) => {
        if (!d) return [0, 1]; // Default range if data point is undefined
        let extents = [d.low, d.high];
        if (indicators.sma && d.sma20) extents.push(d.sma20);
        if (indicators.ema && d.ema50) extents.push(d.ema50);
        if (indicators.bb && d.bb) {
            extents.push(d.bb.top, d.bb.bottom);
        }
        return extents;
    }, [indicators]);

    const margin = { left: 70, right: 70, top: 20, bottom: 30 };

    const handleChartDoubleClick = useCallback(() => {
        setDisplayData(data); // Show all data on double click
    }, [data]);

    const handleSaveLayout = () => {
        const currentLayout = {
          chartType,
          indicators,
          timeframe,
        };
        localStorage.setItem('chartLayout', JSON.stringify(currentLayout));
      };
    
      const handleLoadLayout = () => {
        const savedLayout = localStorage.getItem('chartLayout');
        if (savedLayout) {
          const parsedLayout = JSON.parse(savedLayout);
          setChartType(parsedLayout.chartType);
          setIndicators(parsedLayout.indicators);
          setTimeframe(parsedLayout.timeframe);
        }
      };

    return (
        <Box sx={{ width: '100vw', height: '100vh', bgcolor: theme.palette.background.default, color: theme.palette.text.primary }}>
            <Box sx={{ p: 2 }}>
                <input type="file" onChange={handleFileUpload} accept=".csv" disabled={isLoading} />
                <FormControl sx={{ m: 1, minWidth: 120 }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select value={chartType} onChange={(e) => setChartType(e.target.value)} label="Chart Type">
                        <MenuItem value="candlestick">Candlestick</MenuItem>
                        <MenuItem value="line">Line</MenuItem>
                        <MenuItem value="bar">Bar</MenuItem>
                    </Select>
                </FormControl>
                {Object.keys(indicators).map((indicator) => (
                    <Button key={indicator} onClick={() => setIndicators(prev => ({ ...prev, [indicator]: !prev[indicator] }))}>
                        {indicator.toUpperCase()}
                    </Button>
                ))}
                <Button onClick={handleSaveLayout}>Save Layout</Button>
                <Button onClick={handleLoadLayout}>Load Layout</Button>
            </Box>
            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <CircularProgress />
                    <Typography variant="h6" sx={{ ml: 2 }}>Loading data...</Typography>
                </Box>
            )}
            {error && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            )}
            {!isLoading && !error && calculatedData.length > 0 && (
                <Suspense fallback={<CircularProgress />}>
                    <ChartCanvas
                        height={dimensions.height - 100}
                        ratio={1}
                        width={dimensions.width}
                        margin={margin}
                        data={calculatedData}
                        displayXAccessor={displayXAccessor}
                        seriesName="FOREX"
                        xScale={xScale}
                        xAccessor={xAccessor}
                        xExtents={xExtents}
                        zoomAnchor={lastVisibleItemBasedZoomAnchor}
                        onDoubleClick={handleChartDoubleClick}
                    >
                        <Chart id={1} yExtents={yExtents}>
                            <XAxis axisAt="bottom" orient="bottom" />
                            <YAxis axisAt="right" orient="right" ticks={5} />
                            {chartType === 'candlestick' && <CandlestickSeries />}
                            {chartType === 'line' && <LineSeries yAccessor={d => d.close} />}
                            {chartType === 'bar' && <BarSeries yAccessor={d => d.close} />}
                            {indicators.sma && <LineSeries yAccessor={d => d.sma20} stroke={theme.palette.primary.main} />}
                            {indicators.ema && <LineSeries yAccessor={d => d.ema50} stroke={theme.palette.secondary.main} />}
                            {indicators.bb && (
                                <>
                                    <LineSeries yAccessor={d => d.bb.top} stroke={theme.palette.success.main} />
                                    <LineSeries yAccessor={d => d.bb.middle} stroke={theme.palette.warning.main} />
                                    <LineSeries yAccessor={d => d.bb.bottom} stroke={theme.palette.error.main} />
                                </>
                            )}
                            <MouseCoordinateY at="right" orient="right" displayFormat={format(".2f")} />
                            <PriceCoordinate
                                at="right"
                                orient="right"
                                price={calculatedData[calculatedData.length - 1].close}
                                displayFormat={format(".2f")}
                                fill={theme.palette.success.main}
                                lineStroke={theme.palette.success.main}
                                lineOpacity={0.8}
                                textFill={theme.palette.success.main}
                            />
                            <OHLCTooltip origin={[-40, 0]} />
                            <MovingAverageTooltip
                                onClick={e => console.log(e)}
                                origin={[-38, 15]}
                                options={[
                                    {
                                        yAccessor: d => d.sma20,
                                        type: "SMA",
                                        stroke: theme.palette.primary.main,
                                        windowSize: 20,
                                    },
                                    {
                                        yAccessor: d => d.ema50,
                                        type: "EMA",
                                        stroke: theme.palette.secondary.main,
                                        windowSize: 50,
                                    },
                                ]}
                            />
                        </Chart>
                        {indicators.rsi && (
                            <Chart id={2} yExtents={[0, 100]} height={125} origin={(w, h) => [0, h - 250]}>
                                <XAxis axisAt="bottom" orient="bottom" />
                                <YAxis axisAt="right" orient="right" ticks={5} />
                                <LineSeries yAccessor={d => d.rsi} stroke={theme.palette.info.main} />
                                <InteractiveYCoordinate yCoordinateList={[{ yValue: 30, id: 'rsi-lower' }, { yValue: 70, id: 'rsi-upper' }]} />
                            </Chart>
                        )}
                        {indicators.macd && (
                            <Chart id={3} yExtents={d => d.macd} height={125} origin={(w, h) => [0, h - 125]}>
                                <XAxis axisAt="bottom" orient="bottom" />
                                <YAxis axisAt="right" orient="right" ticks={5} />
                                <LineSeries yAccessor={d => d.macd.macd} stroke={theme.palette.error.main} />
                                <LineSeries yAccessor={d => d.macd.signal} stroke={theme.palette.warning.main} />
                                <BarSeries yAccessor={d => d.macd.histogram} fill={d => d.macd.histogram >= 0 ? theme.palette.success.main : theme.palette.error.main} />
                            </Chart>
                        )}
                        {indicators.atr && (
                            <Chart id={4} yExtents={d => d.atr} height={125} origin={(w, h) => [0, h - 375]}>
                                <XAxis axisAt="bottom" orient="bottom" />
                                <YAxis axisAt="right" orient="right" ticks={5} />
                                <LineSeries yAccessor={d => d.atr} stroke={theme.palette.text.secondary} />
                            </Chart>
                        )}
                        <CrossHairCursor />
                    </ChartCanvas>
                    <VolumeProfiler data={calculatedData} chartHeight={dimensions.height - 100} chartWidth={dimensions.width} margin={margin} />
                    <NewsEvents data={calculatedData} xScale={xScale} chartHeight={dimensions.height - 100} margin={margin} />
                </Suspense>
            )}
            {!isLoading && !error && calculatedData.length === 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                    <Typography variant="h6">Please upload a CSV file to display the chart.</Typography>
                </Box>
            )}
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ForexChart;
