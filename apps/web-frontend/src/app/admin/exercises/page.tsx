import { redirect } from 'next/navigation';

export default function AdminExercisesRedirectPage(): never {
  redirect('/admin/lessons');
}
