import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface RoomTourProps {
    startTour: boolean;
    onTourEnd: () => void;
}

export default function RoomTour({ startTour, onTourEnd }: RoomTourProps) {
    useEffect(() => {
        if (startTour) {
            const driverObj = driver({
                showProgress: true,
                animate: true,
                doneBtnText: 'Selesai',
                nextBtnText: 'Lanjut',
                prevBtnText: 'Kembali',
                onDestroyed: onTourEnd,
                steps: [
                    {
                        element: '#room-header',
                        popover: {
                            title: 'Selamat Datang di Room Rekber',
                            description: 'Ini adalah ruang transaksi aman Anda. Di sini Anda bisa memantau status, chat, dan mengelola transaksi.',
                            side: 'bottom',
                            align: 'start'
                        }
                    },
                    {
                        element: '#room-status-badge',
                        popover: {
                            title: 'Status Room',
                            description: 'Indikator ini menunjukkan status terkini dari room dan transaksi Anda.',
                            side: 'bottom'
                        }
                    },
                    {
                        element: '#participants-section',
                        popover: {
                            title: 'Peserta',
                            description: 'Lihat siapa saja yang sudah bergabung (Buyer/Seller) dan status online mereka.',
                            side: 'bottom'
                        }
                    },
                    {
                        element: '#transaction-progress',
                        popover: {
                            title: 'Progres Transaksi',
                            description: 'Pantau tahapan transaksi dari awal hingga selesai. Langkah aktif akan disorot.',
                            side: 'top'
                        }
                    },
                    {
                        element: '#chat-section',
                        popover: {
                            title: 'Chat Room',
                            description: 'Berkomunikasi dengan pihak lain dan GM. Semua percakapan tercatat untuk keamanan.',
                            side: 'left'
                        }
                    },
                    {
                        element: '#action-buttons',
                        popover: {
                            title: 'Tombol Aksi',
                            description: 'Lakukan tindakan sesuai peran Anda (Upload Bukti, Upload Resi, atau Reset Room).',
                            side: 'top'
                        }
                    },
                    {
                        element: '#share-section',
                        popover: {
                            title: 'Bagikan Room',
                            description: 'Undang pihak lain dengan menyalin link ini. Gunakan PIN untuk keamanan tambahan.',
                            side: 'top'
                        }
                    }
                ]
            });

            driverObj.drive(0);
        }
    }, [startTour, onTourEnd]);

    return null;
}
