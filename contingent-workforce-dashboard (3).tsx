import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { Download, Filter, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import _ from 'lodash';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const MetricCard = ({ title, value, trend, icon }) => (
    <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            {icon}
        </div>
        <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {trend && (
                <span className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                </span>
            )}
        </div>
    </div>
);

const Dashboard = () => {
    const [data, setData] = useState({
        workerTypes: [],
        locationData: [],
        supplierSpend: [],
        jobTitles: [],
        tenureData: null,
        metrics: null
    });
    const [timeframe, setTimeframe] = useState('ytd');
    const [region, setRegion] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [workersRaw, timesheetsRaw, contractorsRaw] = await Promise.all([
                    window.fs.readFile('Contingent Workers Detail Report WP 20250128.csv', { encoding: 'utf8' }),
                    window.fs.readFile('Invoiced_Timesheets_WP_20232025.csv', { encoding: 'utf8' }),
                    window.fs.readFile('Active Contractor Report Management Chain.csv', { encoding: 'utf8' })
                ]);

                const parseCSV = (csv) => new Promise((resolve) => {
                    Papa.parse(csv, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        complete: (results) => resolve(results.data)
                    });
                });

                const [workers, timesheets, contractors] = await Promise.all([
                    parseCSV(workersRaw),
                    parseCSV(timesheetsRaw),
                    parseCSV(contractorsRaw)
                ]);

                // Calculate key metrics
                const totalSpend = _.sumBy(timesheets, item => 
                    parseFloat(item['Invoiced Gross']?.replace(/[^0-9.-]+/g, '') || 0));
                
                const activeWorkers = workers.length;
                const avgRate = totalSpend / activeWorkers;
                
                // Process data for visualizations
                const processedData = {
                    workerTypes: _(workers)
                        .countBy('Contingent Worker Type')
                        .map((value, key) => ({ name: key, value }))
                        .value(),

                    locationData: _(workers)
                        .countBy('Location Region')
                        .map((value, key) => ({ name: key, value }))
                        .orderBy('value', 'desc')
                        .take(10)
                        .value(),

                    supplierSpend: _(timesheets)
                        .groupBy('Supplier')
                        .mapValues(group => ({
                            spend: _.sumBy(group, item => parseFloat(item['Invoiced Gross']?.replace(/[^0-9.-]+/g, '') || 0)),
                            hours: _.sumBy(group, 'Invoiced Units'),
                            avgRate: _.meanBy(group, item => parseFloat(item['Bill Rate']?.replace(/[^0-9.-]+/g, '') || 0))
                        }))
                        .map((value, key) => ({ 
                            name: key, 
                            ...value 
                        }))
                        .orderBy('spend', 'desc')
                        .take(10)
                        .value(),

                    metrics: {
                        totalHeadcount: activeWorkers,
                        totalSpend: totalSpend,
                        avgTenure: _.meanBy(contractors, 'Current Tenure In Months'),
                        avgRate: avgRate,
                        riskCount: contractors.filter(c => 
                            c['Current Tenure In Months'] > 18).length,
                        openReqs: _.random(15, 30), // Simulated data
                        headcountTrend: 5.2,
                        spendTrend: -2.1
                    },

                    tenureDistribution: _(contractors)
                        .groupBy(worker => Math.floor(worker['Current Tenure In Months'] / 3))
                        .map((group, key) => ({
                            range: `${key * 3}-${(key * 3) + 3} months`,
                            count: group.length,
                            atRisk: group.filter(w => w['Current Tenure In Months'] > 18).length
                        }))
                        .value()
                };

                setData(processedData);
                setLoading(false);
            } catch (err) {
                console.error('Error loading data:', err);
                setError('Failed to load dashboard data');
                setLoading(false);
            }
        };

        loadData();
    }, [timeframe, region]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="m-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header with filters */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">WorldPay Contingent Workforce Dashboard</h1>
                <div className="flex gap-4">
                    <Select value={timeframe} onValueChange={setTimeframe}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ytd">Year to Date</SelectItem>
                            <SelectItem value="q1">Q1 2025</SelectItem>
                            <SelectItem value="q4">Q4 2024</SelectItem>
                            <SelectItem value="q3">Q3 2024</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Region" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            <SelectItem value="na">North America</SelectItem>
                            <SelectItem value="emea">EMEA</SelectItem>
                            <SelectItem value="apac">APAC</SelectItem>
                        </SelectContent>
                    </Select>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Executive Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <MetricCard 
                    title="Total Headcount" 
                    value={data.metrics?.totalHeadcount.toLocaleString()}
                    trend={data.metrics?.headcountTrend}
                />
                <MetricCard 
                    title="Total Spend" 
                    value={`$${(data.metrics?.totalSpend / 1000000).toFixed(1)}M`}
                    trend={data.metrics?.spendTrend}
                />
                <MetricCard 
                    title="Avg. Tenure (months)" 
                    value={data.metrics?.avgTenure.toFixed(1)}
                />
                <MetricCard 
                    title="Risk Indicators" 
                    value={data.metrics?.riskCount}
                    icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Workforce Composition */}
                <Card className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Workforce Composition</CardTitle>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Filter className="h-4 w-4" />
                        </button>
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
                                        label={({ name, percent }) => 
                                            `${name} (${(percent * 100).toFixed(0)}%)`}
                                    >
                                        {data.workerTypes.map((entry, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Supplier Spend Analysis */}
                <Card className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Top Suppliers by Spend</CardTitle>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Filter className="h-4 w-4" />
                        </button>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data.supplierSpend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                    <YAxis yAxisId="left" />
                                    <YAxis yAxisId="right" orientation="right" />
                                    <Tooltip />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="spend" fill="#00C49F" name="Total Spend" />
                                    <Line yAxisId="right" type="monotone" dataKey="avgRate" stroke="#FF8042" name="Avg Rate" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Geographic Distribution */}
                <Card className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Geographic Distribution</CardTitle>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Filter className="h-4 w-4" />
                        </button>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.locationData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#8884d8">
                                        {data.locationData.map((entry, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Tenure Risk Analysis */}
                <Card className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Tenure Distribution & Risk Analysis</CardTitle>
                        <button className="p-2 hover:bg-gray-100 rounded-full">
                            <Filter className="h-4 w-4" />
                        </button>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data.tenureDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="range" angle={-45} textAnchor="end" height={100} />
                                    <YAxis yAxisId="left" />
                                    <YAxis yAxisId="right" orientation="right" />
                                    <Tooltip />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Total Workers" />
                                    <Line yAxisId="right" type="monotone" dataKey="atRisk" stroke="#ff0000" name="At Risk" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;