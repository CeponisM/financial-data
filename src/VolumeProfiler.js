import React, { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, curveStepAfter } from 'd3-shape';
import { useTheme } from '@mui/material/styles';
import { calculateVolumeProfile } from './chartWorker';

const VolumeProfiler = ({ data, chartHeight, chartWidth, margin }) => {
  const theme = useTheme();

  const volumeProfile = useMemo(() => {
    console.log('Calculating volume profile', data.length);
    const profile = calculateVolumeProfile(data);
    console.log('Volume profile calculated', profile.length);
    return profile;
  }, [data]);

  const xScale = useMemo(() => {
    console.log('Calculating xScale for volume profile');
    return scaleLinear()
      .domain([0, Math.max(...volumeProfile.map(d => d.volume))])
      .range([0, chartWidth - margin.left - margin.right]);
  }, [volumeProfile, chartWidth, margin]);

  const yScale = useMemo(() => {
    console.log('Calculating yScale for volume profile');
    return scaleLinear()
      .domain([Math.min(...data.map(d => d.low)), Math.max(...data.map(d => d.high))])
      .range([chartHeight - margin.bottom, margin.top]);
  }, [data, chartHeight, margin]);

  const areaGenerator = useMemo(() => {
    console.log('Creating area generator for volume profile');
    return area()
      .x0(0)
      .x1(d => xScale(d.volume))
      .y(d => yScale(d.price))
      .curve(curveStepAfter);
  }, [xScale, yScale]);

  console.log('Rendering VolumeProfiler', volumeProfile.length);

  if (volumeProfile.length === 0) {
    console.log('No volume profile data to render');
    return null;
  }

  return (
    <g transform={`translate(${margin.left}, 0)`}>
      <path
        d={areaGenerator(volumeProfile)}
        fill={theme.palette.primary.main}
        fillOpacity={0.3}
        stroke={theme.palette.primary.main}
        strokeOpacity={0.8}
        strokeWidth={1}
      />
    </g>
  );
};

export default React.memo(VolumeProfiler);
