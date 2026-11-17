import { useEffect } from 'react';

function CoursesPage() {
  useEffect(() => {
    window.location.replace('/bomul.html#courses');
  }, []);

  return null;
}

export default CoursesPage;
