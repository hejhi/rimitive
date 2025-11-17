import { mountToContainer } from './api';
import { AppLayout } from './layouts/AppLayout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Products } from './pages/Products';
import { Product } from './pages/Product';
import { NotFound } from './pages/NotFound';
import { api } from './api';

// Define the application routes
const App = api.route('/', AppLayout)(
  api.route('', Home)(),
  api.route('about', About)(),
  api.route('products', Products)(
    api.route(':id', Product)()
  ),
  // Catch-all route for 404
  api.route('*', NotFound)()
);

// Mount the app to the #app container
const container = document.querySelector('#app');
if (container) {
  mountToContainer(container, App.unwrap());
}
