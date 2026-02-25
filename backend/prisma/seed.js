import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Veritabanı başlangıç verileri (seed) çalıştırılıyor...');

    // Sistemde hiç Admin var mı kontrol et
    const adminCount = await prisma.admin.count();

    if (adminCount === 0) {
        console.log('Sistemde hiç Admin bulunamadı! Varsayılan admin oluşturuluyor...');

        // Varsayılan şifre: 'admin123'
        const hashedPassword = await bcrypt.hash('123456', 10);

        await prisma.admin.create({
            data: {
                fullName: 'Sistem Yöneticisi',
                email: 'admin@turacevre.com', // Kendinize göre değiştirebilirsiniz
                password: hashedPassword,
            },
        });

        console.log('✅ Varsayılan Admin başarıyla oluşturuldu!');
        console.log('Giriş Bilgileri:');
        console.log('------------------------------');
        console.log('E-Posta: admin@turacevre.com');
        console.log('Şifre: admin123');
        console.log('------------------------------');
        console.log('LÜTFEN İLK GİRİŞTEN SONRA HESAP BİLGİLERİNİZİ VE ŞİFRENİZİ DEĞİŞTİRİN!');
    } else {
        console.log('Sistemde zaten admin var, yeni admin oluşturulmadı.');
    }

    // Burada başka varsayılan ayarlar da oluşturulabilir...
}

main()
    .catch((e) => {
        console.error('Seed sırasında hata oluştu:');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
