import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/axios';

const STATUS_COLORS = {
    COMPLETED: '#10b981', // green-500
    PLANNED: '#3b82f6',   // blue-500
    CANCELLED: '#ef4444', // red-500
    FAILED: '#f59e0b',    // yellow-500
    PENDING: '#6b7280',   // gray-500
};

const STATUS_LABELS = {
    COMPLETED: 'Tamamlanan',
    PLANNED: 'Planlanan',
    CANCELLED: 'İptal',
    FAILED: 'Yapılamadı',
    PENDING: 'Bekleyen',
};

export default function AdminStatsChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTodayStats = async () => {
            try {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

                const qs = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
                const { data: events } = await api.get(`/schedule/events?${qs.toString()}`);

                const counts = {
                    COMPLETED: 0,
                    PLANNED: 0,
                    CANCELLED: 0,
                };

                events.forEach(ev => {
                    const status = (ev.status || 'PLANNED').toUpperCase();
                    if (counts.hasOwnProperty(status)) {
                        counts[status]++;
                    }
                });

                const chartData = Object.keys(counts).map(key => ({
                    name: STATUS_LABELS[key],
                    value: counts[key],
                    status: key
                }));

                setData(chartData);
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTodayStats();
    }, []);

    if (loading) return <div className="admin-stats-card placeholder">İstatistikler yükleniyor...</div>;

    const total = data.reduce((acc, cur) => acc + cur.value, 0);

    return (
        <div className="admin-stats-card">
            <div className="card-header">
                <h3 className="card-title">Bugünün Özeti</h3>
                <span className="card-subtitle">Toplam {total} görev</span>
            </div>
            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            interval={0}
                        />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
