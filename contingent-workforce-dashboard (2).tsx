import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import Papa from 'papaparse';
import _ from 'lodash';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard = () => {
    const [data, setData] = useState({
        workerTypes: [],
        locationData: [],
        supplierSpend: [],
        jobTitles: [],
        tenureData: null
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                // Read and parse all files
                const workersRaw = await window.fs.readFile('Contingent Workers Detail Report  WP 20250128.csv', { encoding: 'utf8' });
                const timesheetsRaw = await window.fs.readFile('Invoiced_Timesheets_WP_20232025.csv', { encoding: 'utf8' });
                const contractorsRaw = await window.fs.readFile('Active Contractor Report  Management Chain.csv', { encoding: 'utf8' });

                const parseCSV = (csv) => {
                    return new Promise((resolve) => {
                        Papa.parse(csv, {
                            header: true,
                            dynamicTyping: true,
                            skipEmptyLines: true,
                            complete: (results) => resolve(results.data)
                        });
                    });
                };

                const [workers, timesheets, contractors] = await Promise.all([
                    parseCSV(workersRaw),
                    parseCSV(timesheetsRaw),
                    parseCSV(contractorsRaw)
                ]);

                // Process worker types
                const workerTypes = _(workers)
                    .countBy('Contingent Worker Type')
                    .map((value, key) => ({ name: key, value }))
                    .value();

                // Process location data
                const locationData = _(workers)
                    .countBy('Location Region')
                    .map((value, key) => ({ name: key, value }))
                    .orderBy('value', 'desc')
                    .take(10)
                    .value();

                // Process supplier spend
                const supplierSpend = _(timesheets)
                    .groupBy('Supplier')
                    .mapValues(group => _.sumBy(group, item => 
                        parseFloat(item['Invoiced Gross']?.replace(/[^0-9.-]+/g, '') || 0)))
                    .map((value, key) => ({ name: key, spend: value }))
                    .orderBy('spend', 'desc')
                    .take(10)
                    .value();

                // Process job titles
                const jobTitles = _(workers)
                    .countBy('Business Title')
                    .map((value, key) => ({ title: key, count: value }))
                    .orderBy('count', 'desc')
                    .take(10)
                    .value();

                // Calculate average tenure
                const tenureData = {
                    average: _.meanBy(contractors, 'Current Tenure In Months'),
                    distribution: _(contractors)
                        .groupBy(worker => Math.floor(worker['Current Tenure In Months'] / 3))
                        .map((group, key) => ({
                            range: `${key * 3}-${(key * 3) + 3} months`,
                            count: group.length
                        }))
                        .value()
                };

                setData({
                    workerTypes,
                    locationData,
                    supplierSpend,
                    jobTitles,
                    tenureData
                });

            } catch (error) {
                console.error('Error loading data:', error);
            }
        };

        loadData();
    }, []);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl font-bold mb-6">WorldPay Contingent Workforce Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Workforce Composition */}
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Workforce Composition</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.workerTypes}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    >
                                        {data.workerTypes.map((entry, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Geographic Distribution */}
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Top 10 Locations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.locationData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#8884d8" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Suppliers by Spend */}
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Top Suppliers by Spend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.supplierSpend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="spend" fill="#00C49F" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Tenure Distribution */}
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Tenure Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.tenureData?.distribution || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="range" angle={-45} textAnchor="end" height={100} />
                                    <YAxis />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="count" fill="#8884d8" stroke="#8884d8" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Job Titles */}
                <Card className="w-full md:col-span-2">
                    <CardHeader>
                        <CardTitle>Top Job Titles Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.jobTitles}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#FFBB28" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;