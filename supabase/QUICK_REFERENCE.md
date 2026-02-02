# 🚀 DentalOS Database - Quick Reference Card

## ⚡ Quick Deploy (30 Seconds)

1. **Open**: Supabase Dashboard → SQL Editor → New Query
2. **Copy/Paste**: Entire content of `init_database_final.sql`
3. **Run**: Click the Run button
4. **Login**: admin@clinic.com / KingKira16

✅ Done! Your database is ready.

---

## 📁 File Guide

| File | Purpose | When to Use |
|------|---------|-------------|
| **init_database_final.sql** ⭐ | Complete database setup | Fresh install or full reset |
| **fix_all_rls_policies.sql** | Updates policies only | Fix RLS on existing database |
| **production_guide.md** | Full documentation | Reference and troubleshooting |

---

## 🔑 Default Credentials

```
Email: admin@clinic.com
Password: KingKira16
Role: Admin (full access)
```

> ⚠️ **IMPORTANT**: Change password after first login!

---

## 🎯 What You Get

✅ 7 tables with complete schema  
✅ 26 RLS policies (role-based security)  
✅ 14 performance indexes  
✅ 10 sample treatments loaded  
✅ Auto user profile creation  
✅ Timestamp triggers  

---

## 🔧 Common Commands

### Check if admin exists
```sql
SELECT * FROM public.users WHERE email = 'admin@clinic.com';
```

### Reset admin password
```sql
UPDATE auth.users
SET encrypted_password = crypt('NewPassword', gen_salt('bf'))
WHERE email = 'admin@clinic.com';
```

### View all policies
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check table sizes
```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

---

## 🚨 Troubleshooting Quick Fixes

| Error | Quick Fix |
|-------|-----------|
| "infinite recursion" | Run `fix_all_rls_policies.sql` |
| "row violates RLS policy" | Run `fix_all_rls_policies.sql` |
| "column email does not exist" | Run `init_database_final.sql` |
| Login fails | Check browser console, verify credentials |
| Port 3000 in use | Try http://localhost:5173 instead |

---

## 🛡️ Security Checklist

- [ ] Change admin password from default
- [ ] Review RLS policies for your needs
- [ ] Set up automated database backups  
- [ ] Configure email templates in Supabase
- [ ] Add 2FA for admin account (optional)
- [ ] Review Supabase project access settings

---

## 📊 Role Permissions Summary

| Permission | Admin | Receptionist | Dentist | Accountant |
|------------|:-----:|:------------:|:-------:|:----------:|
| View All | ✅ | ✅ | ✅ | ✅ |
| Patients | ✅ | ✅ | ❌ | ❌ |
| Appointments | ✅ | ✅ | ✅ | ❌ |
| Treatments | ✅ | ❌ | ✅ | ❌ |
| Invoices | ✅ | ❌ | ❌ | ✅ |
| Payments | ✅ | ❌ | ❌ | ✅ |
| Delete | ✅ | ❌ | ❌ | ❌ |

---

## 📝 Next Steps After Deploy

1. ✅ Test login with admin credentials
2. ✅ Add a test patient
3. ✅ Create a test appointment
4. ✅ Change admin password
5. ✅ Create additional users (receptionist, dentist, etc.)
6. ✅ Customize treatment catalog
7. ✅ Set up backups

---

## 🆘 Need Help?

1. Check `production_guide.md` for detailed troubleshooting
2. Review Supabase Dashboard → Logs for errors
3. Check browser console (F12) for client-side issues
4. Verify database connection in Supabase settings

---

## ✨ Database Health Check

Run this monthly:
```sql
-- Check for orphaned records
SELECT 
    'appointments' as table_name,
    COUNT(*) as orphaned_count
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 
    'invoices',
    COUNT(*)
FROM invoices i
LEFT JOIN appointments a ON i.appointment_id = a.id
WHERE a.id IS NULL;
```

---

**Status**: ✅ Production Ready  
**Version**: 1.0  
**Last Updated**: 2025-11-20
