const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) acc[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function clearStorage() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }
  
  console.log('Found buckets:', buckets.map(b => b.name));

  for (const bucket of buckets) {
    console.log(`\nClearing bucket: ${bucket.name}`);
    
    // We need to fetch all files in the bucket. We'll list with pagination.
    let allFiles = [];
    let offset = 0;
    const limit = 100;
    
    while (true) {
      const { data: files, error: listError } = await supabase.storage.from(bucket.name).list('', {
        limit,
        offset,
      });
      
      if (listError) {
        console.error(`Error listing files in ${bucket.name}:`, listError);
        break;
      }
      
      if (!files || files.length === 0) {
        break;
      }
      
      // Filter out the empty placeholder file (often named .emptyFolderPlaceholder)
      const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
      allFiles.push(...validFiles);
      
      if (files.length < limit) break;
      offset += limit;
    }
    
    if (allFiles.length === 0) {
      console.log(`Bucket ${bucket.name} is empty.`);
      continue;
    }

    console.log(`Found ${allFiles.length} files/folders to delete in ${bucket.name}...`);
    
    // Recursive folder deletion function
    async function deleteRecursively(bucketName, currentPath, items) {
      const pathsToDelete = [];
      
      for (const item of items) {
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        
        // Note: supabase storage list() doesn't strictly identify folders vs files well 
        // without id. If id is null, it's a folder.
        if (item.id === null || item.metadata === null) {
          // It's a subfolder
          const { data: subFiles } = await supabase.storage.from(bucketName).list(itemPath, { limit: 1000 });
          if (subFiles && subFiles.length > 0) {
            await deleteRecursively(bucketName, itemPath, subFiles.filter(f => f.name !== '.emptyFolderPlaceholder'));
          }
        } else {
          pathsToDelete.push(itemPath);
        }
      }
      
      if (pathsToDelete.length > 0) {
        // Delete in chunks of 100
        for (let i = 0; i < pathsToDelete.length; i += 100) {
          const chunk = pathsToDelete.slice(i, i + 100);
          const { error: removeError } = await supabase.storage.from(bucketName).remove(chunk);
          if (removeError) {
            console.error(`Error deleting chunk in ${bucketName}:`, removeError);
          } else {
            console.log(`Deleted ${chunk.length} files from ${bucketName}`);
          }
        }
      }
    }

    await deleteRecursively(bucket.name, '', allFiles);
    console.log(`Finished clearing ${bucket.name}`);
  }
}

clearStorage();
