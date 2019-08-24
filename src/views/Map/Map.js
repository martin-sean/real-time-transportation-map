import React, { Component } from 'react'
import { Map as LeafletMap, TileLayer, Marker, Popup, Tooltip, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
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

// Importing Packages
const axios = require('axios');
const moment = require('moment');

function getStationDepartures() {
    return axios.get('/api/stationDepartures');
}

function getRuns() {
    return axios.get('/api/train');
}

function getUniqueStops() {
    return axios.get('/api/uniqueStops');
}

export default class Map extends Component {
    mapRef = React.createRef();

    constructor(props) {
        super(props);
        this.state = {
            lat: -37.814,
            lng: 144.96332,
            zoom: 13,
            stationDepartures: [],
            runs: [],
            uniqueStops: []
        };
    }

    returnStopName(stopID) {
        for (let i in this.state.uniqueStops) {
            let stop = this.state.uniqueStops[i];
            if(stop.stop_id === stopID) {
                return stop.stop_name;
            }
        }
    }

    findStopIndex(stopID) {
        for (let i in this.state.uniqueStops) {
            if(this.state.uniqueStops[i].stop_id === stopID) {
                return i;
            }
        }
    }

    componentDidMount() {
        axios.all([getStationDepartures(), getRuns(), getUniqueStops()])
        .then((response) => {
            this.setState({
                stationDepartures: response[0].data,
                runs: response[1].data.runs,
                uniqueStops: response[2].data
            });
        });

        setInterval(() => {
            axios.all([getStationDepartures(), getRuns(), getUniqueStops()])
            .then((response) => {
                this.setState({
                    stationDepartures: response[0].data,
                    runs: response[1].data.runs,
                    uniqueStops: response[2].data
                });
            });
        }, 15000);
    }

    render() {
        const position = [this.state.lat, this.state.lng];
        const stations = this.state.stationDepartures;
        const runs = this.state.runs;

        // Hard Code Route Names for now
        const routeNames = ["Alamein",
                              "Belgrave",
                              "Craigieburn",
                              "Cranbourne",
                              "Mernda",
                              "Frankston",
                              "Glen Waverly",
                              "Hurstbridge",
                              "Lilydale",
                              "",
                              "Pakenham",
                              "Sandringham",
                              "Stony Point",
                              "Sunbury",
                              "Upfield",
                              "Werribee",
                              "Williamstown"]

        return (
            <LeafletMap ref={this.mapRef} center={position} zoom={this.state.zoom} maxZoom={17}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    // url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    url='https://api.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoic2lhdzk2IiwiYSI6ImNqdHRra3FuNDFjeW00MHBjMnNveGdha2QifQ.HK8K4aseYwzjdqAStXAyxg'
                />

                <MarkerClusterGroup maxClusterRadius={10}>
                    {
                        runs.map((key, index) => {
                            if (runs[index].departure[0].estimated_departure_utc) {
                                // Determine timestamp (arrival time)
                                let timeStamp;
                                let icon;
                                let angle;
                                let tooltip;

                                if (runs[index].departure[0].estimated_departure_utc) {
                                    const estimatedTime = moment.utc(runs[index].departure[0].estimated_departure_utc);
                                    timeStamp = Math.abs(estimatedTime.diff(moment.utc(), 'minutes'));
                                } else {
                                    const scheduledTime = moment.utc(runs[index].departure[0].scheduled_departure_utc);
                                    timeStamp = Math.abs(scheduledTime.diff(moment.utc(), 'minutes'));
                                }

                                const previousStopCoordinates = runs[index].coordinates.previousStopCoordinates;
                                const nextStopCoordinates = runs[index].coordinates.nextStopCoordinates;
                                let coordinates;

                                // For trains that are scheduled to depart from a station
                                if (!previousStopCoordinates) {
                                    coordinates = runs[index].coordinates.nextStopCoordinates;
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
                                    const departureTime = moment.utc(filteredDepartures[i].estimated_departure_utc);
                                    const differenceInTime = Math.abs(departureTime.diff(moment.utc(), 'minutes'));
                                    const stopName = this.returnStopName(filteredDepartures[i].stop_id);
                                    filteredDetails.push({
                                        stopName: stopName,
                                        differenceInTime: differenceInTime
                                    });
                                }

                                // For running trains at platform
                                console.log("CP0: ");
                                console.log(coordinates);
                                if (runs[index].departure[0].at_platform) {
                                    coordinates = runs[index].coordinates.nextStopCoordinates;
                                    console.log("CP1: ");
                                    console.log(coordinates);
                                    tooltip = <Tooltip>
                                        <span><strong> {routeNames[runs[index].departure[0].route_id - 1]} </strong></span><br />
                                        <span><strong>At {filteredDetails[0].stopName}</strong></span><br />
                                        <span><strong>Run ID:</strong> {runs[index].departure[0].run_id}</span><br />
                                        <span><strong>Arrival Time:</strong> {timeStamp} min</span><br />
                                        <span><strong>Direction ID:</strong> {runs[index].coordinates.direction_id}</span>
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
                                    coordinates = Departures.determineRunCoordinates(scalar, previousStopCoordinates, nextStopCoordinates);
                                    console.log("CP2: ");
                                    console.log(coordinates);
                                    tooltip = <Tooltip>
                                        <span><strong> {routeNames[runs[index].departure[0].route_id - 1]} </strong></span><br />
                                        <span><strong>Run ID:</strong> {runs[index].departure[0].run_id}</span><br />
                                        <span><strong>Arrival Time:</strong> {timeStamp} min</span><br />
                                        <span><strong>Direction ID:</strong> {runs[index].coordinates.direction_id}</span>
                                    </Tooltip>
                                }

                                if (icon === trainIcon) {
                                    console.log("CP3: ");
                                    console.log(coordinates);
                                    return <Marker icon={trainIcon} position={coordinates}>
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
                                            <span><strong> {routeNames[runs[index].departure[0].route_id - 1]} </strong></span><br />
                                            <span><strong>Run ID:</strong> {runs[index].departure[0].run_id}</span><br />
                                            <span><strong>Departure Time:</strong> {timeStamp}</span>
                                        </Tooltip>
                                    </Marker>
                                } else {
                                    return <RotatedMarker icon={icon} position={coordinates} rotationAngle={angle} rotationOrigin={'center'}>
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
                            }
                        })
                    }
                </MarkerClusterGroup>

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
                                                let highlight = diff >= 10 ? "very-late-highlight" : diff >= 5 ? "late-highlight" : "behind-highlight";
                                                schedule = <mark id={highlight}>{'(' + diff + ' min late)'}</mark>;
                                            }

                                            return <span>
                                                <strong>(Estimated)</strong> {routeNames[stations[index].departures[index2].route_id - 1]}
                                                (Direction: {stations[index].departures[index2].direction_id}) -> {timeStamp} mins {schedule}<br/>
                                            </span>
                                        } else {
                                            time = moment.utc(stations[index].departures[index2].scheduled_departure_utc);
                                            let timeStamp = Math.abs(time.diff(moment.utc(), 'minutes'));
                                            return <span>
                                                (Scheduled) {routeNames[stations[index].departures[index2].route_id - 1]}
                                                (Direction: {stations[index].departures[index2].direction_id}) -> {timeStamp} mins<br/>
                                            </span>
                                        }
                                    })
                                }
                            </Tooltip>
                        </Marker>
                    })
                }

                {
                // REQUIRES STATIONS SEPERATED INTO
                //     stations.map((key, index) => {
                //         if (index < stations.length - 1) {
                //             const positions = [[stations[index].stop_latitude, stations[index].stop_longitude], [stations[index + 1].stop_latitude, stations[index + 1].stop_longitude]];
                //             return <Polyline positions={positions} />
                //         }
                //     })
                }
            </LeafletMap >
        );
    }
}
