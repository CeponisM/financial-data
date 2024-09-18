import React, { useState, useEffect } from 'react';
import { scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';
import { useTheme } from '@mui/material/styles';
import { Tooltip, Typography, Box } from '@mui/material';

const NewsEvents = ({ data, xScale, chartHeight, margin }) => {
  const theme = useTheme();
  const [newsEvents, setNewsEvents] = useState([]);

  useEffect(() => {
    // In a real-world scenario, you would fetch news events from an API
    // This is a mock implementation
    const mockNewsEvents = [
      { date: new Date(2023, 5, 15), title: "Interest Rate Decision", impact: "high" },
      { date: new Date(2023, 5, 20), title: "GDP Report", impact: "medium" },
      { date: new Date(2023, 5, 25), title: "Unemployment Rate", impact: "high" },
    ];
    setNewsEvents(mockNewsEvents);
  }, []);

  const formatDate = timeFormat("%Y-%m-%d");

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      default:
        return theme.palette.info.main;
    }
  };

  return (
    <g>
      {newsEvents.map((event, index) => {
        const xPosition = xScale(event.date);
        if (xPosition < margin.left || xPosition > chartHeight - margin.right) return null;

        return (
          <Tooltip
            key={index}
            title={
              <Box>
                <Typography variant="subtitle2">{event.title}</Typography>
                <Typography variant="body2">Date: {formatDate(event.date)}</Typography>
                <Typography variant="body2">Impact: {event.impact}</Typography>
              </Box>
            }
          >
            <line
              x1={xPosition}
              y1={margin.top}
              x2={xPosition}
              y2={chartHeight - margin.bottom}
              stroke={getImpactColor(event.impact)}
              strokeWidth={2}
              strokeDasharray="5,5"
            />
          </Tooltip>
        );
      })}
    </g>
  );
};

export default NewsEvents;
