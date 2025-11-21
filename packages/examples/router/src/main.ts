import { mountToContainer, router } from './service';
import { AppLayout } from './layouts/AppLayout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Products } from './pages/Products';
import { Product } from './pages/Product';
import { NotFound } from './pages/NotFound';

// Define the application routes
const App = router.route('/', AppLayout())(
  router.route('', Home())(),
  router.route('about', About())(),
  router.route('products', Products())(router.route(':id', Product())()),
  // Catch-all route for 404
  router.route('*', NotFound())()
);

// Mount the app to the #app container
const container = document.querySelector('#app');
if (container) {
  mountToContainer(container, App.unwrap());
}
