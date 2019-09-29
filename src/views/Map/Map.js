import React, { Component } from 'react';
import { Map as LeafletMap, LayerGroup, TileLayer, Marker, Popup, Tooltip, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import Control from 'react-leaflet-control'
// import worldGeoJSON from 'geojson-world-map';

import './Map.css';

// Importing Submodules
import * as Stations from '../../modules/stations';
import * as Departures from '../../modules/departures';

// Importing Components
import { railIcon } from '../../components/leaflet-icons/rail-icon/rail-icon';
import { trainIcon } from '../../components/leaflet-icons/train-icon/train-icon';
import { trainSideIcon } from '../../components/leaflet-icons/train-icon/train-side-icon';
import { trainSideInvertedIcon } from '../../components/leaflet-icons/train-icon/train-side-inverted-icon';
import RotatedMarker from '../../components/leaflet-icons/RotatedMarker';
import {Button} from "reactstrap";

// Importing Packages
const axios = require('axios');
const moment = require('moment');

// Icon scaling constants
const ICON_SCALE_FACTOR = 3;
const MAX_VEHICLE_ICON_LEN = 50;
const MAX_STATION_ICON_LEN = 40;
const MIN_ICON_SIZE = 10;

// Update frequency
const DEF_API_REP_FREQ = 30;
const MIN_API_REP_FREQ = 15;
const MAX_API_REP_FREQ = 600;
const SECONDS_TO_MS = 1000;

function getRouteDescriptions() {
    return axios.get('/api/routes');
}

function getStationDepartures() {
    return axios.get('/api/stationDepartures');
}

function getRuns() {
    return axios.get('/api/runs');
}

function swapRouteType() {
    axios.post('/api/swapRouteType');
}

// Set refresh rate from API side if already previously set
function initialiseRefreshRate() {
    axios.get('/refresh')
        .then((response) => {
            this.refreshRate = response.data.refresh;
            setInitialRefreshRate(this.refreshRate);
        })
        .catch(error => {
            this.refreshRate = DEF_API_REP_FREQ;
            setInitialRefreshRate(this.refreshRate);
        });
}

function setInitialRefreshRate(refresh) {
    displayRefresh(refresh);
    document.getElementById("refreshSlider").value = refresh;
    this.refresh = setInterval(this.updateData, refresh * SECONDS_TO_MS);
}

// Update API rate according to slider value
function updateRefresh() {
    this.refreshRate = document.getElementById("refreshSlider").value;


    // Stop the current refresh cycle and restart with new refresh time
    if(this.refresh != null) {
        console.log("Setting new refresh rate to: " + this.refreshRate + " seconds");
        clearInterval(this.refresh);
        this.refresh = setInterval(this.updateData, this.refreshRate * SECONDS_TO_MS);
    }

    axios.post('/refresh', {refreshRate: this.refreshRate});
}

// Update text above slider to reflect refresh value
function displayRefresh(refresh) {
    let text = refresh + " seconds";

    document.getElementById("refreshDisplay").value = text;
    document.getElementById("refreshDisplay").size = text.length;
}

// Driver to update slider value during drag
function displayRefreshSlider() {
    displayRefresh(document.getElementById("refreshSlider").value);
}

export default class Map extends Component {
    // Event handler when map is zoomed, adjusts icon sizes
    updateData() {
        console.log("Updating data...");
        axios.all([getRouteDescriptions(),
                   getStationDepartures(),
                   getRuns()])
        .then((response) => {
            this.setState({
                routes: response[0].data,
                stationDepartures: response[1].data,
                runs: response[2].data.runs
            });
        });
    }

    updateCurrentCoordinates() {
        const runs = this.state.runs;
        this.setState({
            runs: runs
        });
    }

    // Event handler when map is zoomed, adjusts icon sizes
    handleZoom() {
        // Determine how much to scale icons based on zoom level
        let currZoom = this.mapRef.current.viewport.zoom;
        let maxZoom = this.mapRef.current.props.maxZoom;
        let vehicleSize = MAX_VEHICLE_ICON_LEN * Math.pow((currZoom / maxZoom), ICON_SCALE_FACTOR);
        let stationSize = MAX_STATION_ICON_LEN * Math.pow((currZoom / maxZoom), ICON_SCALE_FACTOR);

        // Disable station icons if they become too small (zoom too far away)
        if(stationSize > MIN_ICON_SIZE) {
            railIcon.options.iconSize = [stationSize, stationSize];
        } else {
            railIcon.options.iconSize = [0, 0];
        }

        trainIcon.options.iconSize = [vehicleSize, vehicleSize];
        trainSideIcon.options.iconSize = [vehicleSize, vehicleSize];
        trainSideInvertedIcon.options.iconSize = [vehicleSize, vehicleSize];

        // Force update train icons
        let layers = this.trainRef.current.leafletElement.getLayers();
        for(let i in layers) {
            layers[i].refreshIconOptions();
        }

        // Force update station icons
        layers = this.stationRef.current.leafletElement.getLayers();
        for(let i in layers) {
            layers[i].refreshIconOptions();
        }
    };

    returnStopName(stop_id) {
        for (let i in this.state.stationDepartures) {
            let stop = this.state.stationDepartures[i];
            if(stop.stop_id === stop_id) {
                return stop.stop_name;
            }
        }
    }

    getRouteName(route_id) {
        for (let i in this.state.routes) {
            if(this.state.routes[i].route_id === route_id) {
                return this.state.routes[i].route_name;
            }
        }
    }

    getDirectionName(route_id, direction_id) {
        for(let i in this.state.routes) {
            if(this.state.routes[i].route_id === route_id) {
                for(let j in this.state.routes[i].directions) {
                    if(this.state.routes[i].directions[j].direction_id === direction_id) {
                        return this.state.routes[i].directions[j].direction_name;
                    }
                }
            }
        }
    }

    componentDidMount() {
        this.updateData();
        initialiseRefreshRate();
        setInterval(this.updateCurrentCoordinates, 5000);
    }

    constructor(props) {
        super(props);

        // Create references to be used when updating icons
        this.mapRef = React.createRef();
        this.trainRef = React.createRef();
        this.stationRef = React.createRef();

        this.state = {
            lat: -37.814,
            lng: 144.96332,
            zoom: 13,
            routes: [],
            stationDepartures: [],
            runs: []
        };

        this.handleZoom = this.handleZoom.bind(this);
        this.updateData = this.updateData.bind(this);
        this.updateCurrentCoordinates = this.updateCurrentCoordinates.bind(this);

        updateRefresh = updateRefresh.bind(this);
        displayRefresh = displayRefresh.bind(this);
        setInitialRefreshRate = setInitialRefreshRate.bind(this);
        initialiseRefreshRate = initialiseRefreshRate.bind(this);
    }

    render() {
        const position = [this.state.lat, this.state.lng];
        const stations = this.state.stationDepartures;
        const runs = this.state.runs;

        return (
            <div id='transport'>
                <LeafletMap id="map" ref={this.mapRef} center={position} zoom={this.state.zoom} maxZoom={17} onZoomEnd={this.handleZoom}>
                    <Control position="topright">
                        <button id="swapRouteTypeButton" onClick={ swapRouteType }>Switch Transport Type &#8693;</button>
                    </Control>
                    <Control position="bottomleft">
                        <div id="refreshBox">
                            Refresh Rate: <input type="text" defaultValue={DEF_API_REP_FREQ + " seconds"} size="10" id="refreshDisplay" disabled/><br/>
                            <input type="range" min={MIN_API_REP_FREQ} max={MAX_API_REP_FREQ} defaultValue={DEF_API_REP_FREQ} id="refreshSlider" onMouseUp={updateRefresh} onChange={displayRefreshSlider}/>
                        </div>
                    </Control>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        // url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        url='https://api.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoic2lhdzk2IiwiYSI6ImNqdHRra3FuNDFjeW00MHBjMnNveGdha2QifQ.HK8K4aseYwzjdqAStXAyxg'
                    />

                    <MarkerClusterGroup maxClusterRadius={10} ref={this.trainRef}>
                        {
                            runs.map((key, index) => {
                                    // Determine timestamp (arrival time)
                                    let timeStamp;
                                    let icon;
                                    let angle;
                                    let tooltip;

                                    if (runs[index].departure[runs[index].currentDeparture].estimated_departure_utc) {
                                        const estimatedTime = moment.utc(runs[index].departure[runs[index].currentDeparture].estimated_departure_utc);
                                        timeStamp = Math.abs(estimatedTime.diff(moment.utc(), 'seconds'));
                                    } else {
                                        const scheduledTime = moment.utc(runs[index].departure[runs[index].currentDeparture].scheduled_departure_utc);
                                        timeStamp = Math.abs(scheduledTime.diff(moment.utc(), 'seconds'));
                                    }

                                    const previousStopCoordinates = runs[index].coordinates.previousStopCoordinates;
                                    const nextStopCoordinates = runs[index].coordinates.nextStopCoordinates;
                                    let coordinates;

                                    // For trains that are scheduled to depart from a station
                                    if (!previousStopCoordinates) {
                                        coordinates = runs[index].coordinates.nextStopCoordinates;
                                        runs[index].currentCoordinates = runs[index].coordinates.nextStopCoordinates;
                                        icon = trainIcon;
                                    } else {
                                        icon = trainSideIcon;

                                        // Determine angle of the train icon
                                        angle = Departures.calculateAngle(previousStopCoordinates, nextStopCoordinates);
                                        if (nextStopCoordinates[0] < previousStopCoordinates[0]) {
                                            angle += 90;
                                        } else {
                                            angle += 90;
                                            icon = trainSideInvertedIcon;
                                        }
                                    }

                                    let filteredDepartures = runs[index].departure;
                                    let filteredDetails = [];

                                    for (let i in filteredDepartures) {
                                        let departureTime;
                                        if(filteredDepartures[i].estimated_departure_utc) {
                                            departureTime = moment.utc(filteredDepartures[i].estimated_departure_utc);
                                        } else {
                                            departureTime = moment.utc(filteredDepartures[i].scheduled_departure_utc);
                                        }
                                        const differenceInTime = departureTime.diff(moment.utc(), 'seconds');
                                        const stopName = this.returnStopName(filteredDepartures[i].stop_id);
                                        if(differenceInTime >= 0) {
                                            filteredDetails.push({
                                                stopName: stopName,
                                                differenceInTime: differenceInTime
                                            });
                                        }
                                    }

                                    // For running trains at platform
                                    if (runs[index].departure[runs[index].currentDeparture].at_platform) {
                                        coordinates = runs[index].coordinates.nextStopCoordinates;
                                        runs[index].currentCoordinates = runs[index].coordinates.nextStopCoordinates;
                                        tooltip = <Tooltip>
                                            <span><strong> {this.getRouteName(runs[index].departure[runs[index].currentDeparture].route_id)} </strong></span><br />
                                            <span><strong>(to {this.getDirectionName(runs[index].departure[runs[index].currentDeparture].route_id,
                                                runs[index].coordinates.direction_id)})</strong></span><br/>
                                            <span><strong>At {filteredDetails[0].stopName}</strong></span><br />
                                            <span><strong>Run ID:</strong> {runs[index].departure[runs[index].currentDeparture].run_id}</span><br />
                                            <span><strong>Arrival Time:</strong> {timeStamp} min</span><br />
                                        </Tooltip>

                                    } else if (previousStopCoordinates) {
                                        let scalar;
                                        if (timeStamp > 3) {
                                            scalar = 0.9;
                                        }
                                        else if (timeStamp === 3) {
                                            scalar = 0.75;
                                        }
                                        else if (timeStamp === 2) {
                                            scalar = 0.6;
                                        }
                                        else if (timeStamp < 1) {
                                            scalar = 0.3;
                                        } else {
                                            scalar = 0.5;
                                        }

                                        if(runs[index].currentDeparture != 0) {
                                            const time1 = moment.utc(runs[index].departure[runs[index].currentDeparture -1].scheduled_departure_utc);
                                            const time2 = moment.utc(runs[index].departure[runs[index].currentDeparture].scheduled_departure_utc);
                                            const travelTime = Math.abs(time2.diff(time1, 'seconds'));
                                            console.log("TravelTime (" + this.returnStopName(runs[index].departure[runs[index].currentDeparture - 1].stop_id) + " -> " + this.returnStopName(runs[index].departure[runs[index].currentDeparture].stop_id) + ") = " + travelTime + ", Remaining = " + timeStamp);
                                            scalar = timeStamp / travelTime;
                                        }

                                        coordinates = Departures.determineRunCoordinates(scalar, previousStopCoordinates, nextStopCoordinates);
                                        runs[index].currentCoordinates = Departures.determineRunCoordinates(scalar, previousStopCoordinates, nextStopCoordinates);
                                        tooltip = <Tooltip>
                                            <span><strong> {this.getRouteName(runs[index].departure[runs[index].currentDeparture].route_id)} </strong></span><br />
                                            <span><strong>(to {this.getDirectionName(runs[index].departure[runs[index].currentDeparture].route_id,
                                                runs[index].coordinates.direction_id)})</strong></span><br/>
                                            <span><strong>Run ID:</strong> {runs[index].departure[runs[index].currentDeparture].run_id}</span><br />
                                            <span><strong>Arrival Time:</strong> {timeStamp} min</span><br />
                                        </Tooltip>
                                    }

                                    if (icon === trainIcon) {
                                        console.log(this.getRouteName(runs[index].departure[runs[index].currentDeparture].route_id) + " Vehicle Coordinates: " + runs[index].currentCoordinates);
                                        return <Marker icon={trainIcon} position={runs[index].currentCoordinates}>
                                            <Popup>
                                                {
                                                    filteredDetails.map((key, index3) => {
                                                        return <span>
                                                        <strong>{filteredDetails[index3].differenceInTime}</strong> minutes -> <strong>{filteredDetails[index3].stopName}</strong>
                                                        <br />
                                                    </span>
                                                    })
                                                }
                                            </Popup>
                                            <Tooltip>
                                                <span><strong> {this.getRouteName(runs[index].departure[runs[index].currentDeparture].route_id)} </strong></span><br />
                                                <span><strong>(to {this.getDirectionName(runs[index].departure[runs[index].currentDeparture].route_id,
                                                    runs[index].coordinates.direction_id)})</strong></span><br/>
                                                <span><strong>Run ID:</strong> {runs[index].departure[runs[index].currentDeparture].run_id}</span><br />
                                                <span><strong>Departure Time:</strong> {timeStamp}</span>
                                            </Tooltip>
                                        </Marker>
                                    } else {
                                        return <RotatedMarker icon={icon} position={runs[index].currentCoordinates} rotationAngle={angle} rotationOrigin={'center'}>
                                            <Popup>
                                                {
                                                    filteredDetails.map((key, index3) => {
                                                        return <span>
                                                        <strong>{filteredDetails[index3].differenceInTime}</strong> minutes -> <strong>{filteredDetails[index3].stopName}</strong>
                                                        <br />
                                                    </span>
                                                    })
                                                }
                                            </Popup>
                                            {tooltip}
                                        </RotatedMarker>
                                    }
                            })
                        }
                    </MarkerClusterGroup>

                    <LayerGroup ref={this.stationRef}>
                        {
                            stations.map((key, index) => {
                                // Render each station with name and departures
                                const coordinates = [stations[index].stop_latitude, stations[index].stop_longitude];

                                return <Marker icon={railIcon} position={coordinates}>
                                    <Tooltip>
                                        <strong>{stations[index].stop_name}</strong><br/>
                                        {
                                            stations[index].departures.map((key, index2) => {
                                                let time;
                                                // Calculated time arrival and render on tooltip
                                                if(stations[index].departures[index2].estimated_departure_utc) {
                                                    time = moment.utc(stations[index].departures[index2].estimated_departure_utc);
                                                    let timeStamp = Math.abs(time.diff(moment.utc(), 'minutes'));

                                                    // Calculate difference in estimated and scheduled time
                                                    let schedule = "";
                                                    const estimatedTime = moment.utc(stations[index].departures[index2].estimated_departure_utc);
                                                    const scheduledTime = moment.utc(stations[index].departures[index2].scheduled_departure_utc);
                                                    let diff = Math.abs(estimatedTime.diff(scheduledTime, 'minutes'));
                                                    if (stations[index].departures[index2].estimated_departure_utc && diff > 0) {
                                                        console.log(this.getRouteName(stations[index].departures[index2].route_id) + " is late by " + diff + " mins");
                                                        let highlight = diff >= 10 ? "very-late-highlight" : diff >= 5 ? "late-highlight" : "behind-highlight";
                                                        schedule = <mark id={highlight}>{'(' + diff + ' min late)'}</mark>;
                                                    }

                                                    return <span>
                                                        <strong>(Estimated)</strong> {this.getRouteName(stations[index].departures[index2].route_id) + " "}
                                                            (to {this.getDirectionName(stations[index].departures[index2].route_id,
                                                            stations[index].departures[index2].direction_id)}) -> {timeStamp} mins {schedule}<br/>
                                                    </span>
                                                } else {
                                                    time = moment.utc(stations[index].departures[index2].scheduled_departure_utc);
                                                    let timeStamp = Math.abs(time.diff(moment.utc(), 'minutes'));
                                                    return <span>
                                                (Scheduled) {this.getRouteName(stations[index].departures[index2].route_id) + " "}
                                                        (to {this.getDirectionName(stations[index].departures[index2].route_id,
                                                        stations[index].departures[index2].direction_id)}) -> {timeStamp} mins<br/>
                                            </span>
                                                }
                                            })
                                        }
                                    </Tooltip>
                                </Marker>
                            })
                        }
                    </LayerGroup>

                    {
                        // REQUIRES STATIONS TO BE SORTED IN TRAVERSAL ORDER
                        //     stations.map((key, index) => {
                        //         if (index < stations.length - 1) {
                        //             const positions = [[stations[index].stop_latitude, stations[index].stop_longitude], [stations[index + 1].stop_latitude, stations[index + 1].stop_longitude]];
                        //             return <Polyline positions={positions} />
                        //         }
                        //     })
                    }
                </LeafletMap>
            </div>
        );
    }
}