import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';

function MyChartComponent() {
  const [data, setData] = useState([]);

  const svgRef = useRef();

  useEffect(() => {
    fetch("/api/data")
      .then(response => response.json())
      .then(fetchedData => {
        // Преобразование формата даты и времени для удобства
        const formattedData = fetchedData.map(item => ({
          datetime: new Date(item.datetime).toLocaleString(),
          spectrumValue: item.spectrumValue,
        }));
        setData(formattedData);
      });
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      const margin = { top: 20, right: 30, bottom: 30, left: 40 };
      const width = 800 - margin.left - margin.right;
      const height = 400 - margin.top - margin.bottom;

      const svg = d3.select(svgRef.current)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand()
        .domain(data.map(d => d.datetime))
        .range([0, width])
        .padding(0.1);

      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.spectrumValue)])
        .nice()
        .range([height, 0]);

      svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

      svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));

      svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.datetime))
        .attr("y", d => y(d.spectrumValue))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.spectrumValue))
        .attr("fill", "#8884d8");
    }
  }, [data]);

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default MyChartComponent; 