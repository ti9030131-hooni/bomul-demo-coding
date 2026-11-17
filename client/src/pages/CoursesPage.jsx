import { useLayoutEffect } from 'react';

function CoursesPage() {
  useLayoutEffect(() => {
    window.location.replace('/bomul.html#courses');
  }, []);

  return null;
}

export default CoursesPage;
