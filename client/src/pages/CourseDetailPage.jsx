import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

function CourseDetailPage() {
  const { id } = useParams();

  useEffect(() => {
    const target = id ? `/bomul.html#course-${encodeURIComponent(id)}` : '/bomul.html#courses';
    window.location.replace(target);
  }, [id]);

  return null;
}

export default CourseDetailPage;
